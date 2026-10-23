"""Local, deterministic vector retrieval for the curated knowledge base.

Embeddings are hashed bag-of-words vectors (256 dimensions) with L2
normalisation. This keeps RAG fully reproducible and runnable without an
external embeddings API. Retrieval quality is intentionally modest; the
research lab documents that limitation instead of overselling it.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import KnowledgeChunk, KnowledgeDocument

DIMENSIONS = 256
TOKEN_PATTERN = re.compile(r"[a-z][a-z0-9']+")
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from",
    "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "should", "so",
    "that", "the", "their", "them", "this", "to", "was", "we", "what", "when", "where",
    "which", "who", "why", "will", "with", "you", "your",
}


def tokenize(text: str) -> list[str]:
    return [token for token in TOKEN_PATTERN.findall(text.lower()) if token not in STOPWORDS]


def embed_text(text: str) -> str:
    values = [0.0] * DIMENSIONS
    tokens = tokenize(text)
    if not tokens:
        return json.dumps(values)
    features: list[str] = list(tokens)
    features.extend(f"{tokens[i]} {tokens[i + 1]}" for i in range(len(tokens) - 1))
    counts: dict[str, int] = {}
    for feature in features:
        counts[feature] = counts.get(feature, 0) + 1
    for feature, count in counts.items():
        digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=4).digest()
        bucket = int.from_bytes(digest, "big") % DIMENSIONS
        sign = 1.0 if digest[0] % 2 == 0 else -1.0
        values[bucket] += sign * (1.0 + math.log(count))
    norm = math.sqrt(sum(value * value for value in values))
    if norm:
        values = [round(value / norm, 6) for value in values]
    return json.dumps(values)


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    return float(sum(a * b for a, b in zip(left, right)))


def chunk_text(content: str, max_chars: int = 480) -> list[str]:
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", content) if part.strip()]
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        candidate = f"{current} {sentence}".strip()
        if len(candidate) > max_chars and current:
            chunks.append(current)
            current = sentence
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def keyword_overlap(query: str, content: str) -> float:
    query_tokens = set(tokenize(query))
    if not query_tokens:
        return 0.0
    content_tokens = set(tokenize(content))
    return len(query_tokens & content_tokens) / len(query_tokens)


@dataclass
class RetrievedChunk:
    chunk_id: int
    title: str
    source: str
    snippet: str
    similarity: float


def retrieve_knowledge(
    db: Session, query: str, limit: int = 3, min_score: float = 0.015
) -> list[RetrievedChunk]:
    rows = db.execute(
        select(KnowledgeChunk, KnowledgeDocument)
        .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
        .order_by(KnowledgeChunk.id)
    ).all()
    if not rows:
        return []
    query_vector = json.loads(embed_text(query))
    scored: list[tuple[float, KnowledgeChunk, KnowledgeDocument]] = []
    for chunk, document in rows:
        try:
            embedding = json.loads(chunk.embedding_json)
        except json.JSONDecodeError:
            continue
        similarity = cosine_similarity(query_vector, embedding)
        overlap = keyword_overlap(query, chunk.content)
        score = similarity + 0.35 * overlap
        if score >= min_score:
            scored.append((score, chunk, document))
    scored.sort(key=lambda item: item[0], reverse=True)
    results: list[RetrievedChunk] = []
    seen_documents: set[int] = set()
    for score, chunk, document in scored:
        if document.id in seen_documents:
            continue
        seen_documents.add(document.id)
        snippet = chunk.content
        if len(snippet) > 360:
            snippet = snippet[:357].rsplit(" ", 1)[0] + "..."
        results.append(
            RetrievedChunk(
                chunk_id=chunk.id,
                title=document.title,
                source=document.source,
                snippet=snippet,
                similarity=round(score, 4),
            )
        )
        if len(results) >= limit:
            break
    return results


def rebuild_embeddings(db: Session) -> int:
    chunks = db.scalars(select(KnowledgeChunk)).all()
    for chunk in chunks:
        chunk.embedding_json = embed_text(chunk.content)
    db.flush()
    return len(chunks)
