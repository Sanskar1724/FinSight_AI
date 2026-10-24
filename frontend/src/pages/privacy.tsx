import { Link } from "react-router-dom";

import { ContactLink, LegalLayout, LegalSection } from "@/components/legal-layout";

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro={
        <p>
          FinSight AI is a free personal-finance planning tool in public beta. This policy explains
          what we collect, why, where it is stored, and the rights you have under India&apos;s
          Digital Personal Data Protection Act, 2023. In short: we only keep what you choose to
          enter, we never connect to your bank, and you can export or delete everything at any time.
        </p>
      }
    >
      <LegalSection title="1. What we collect">
        <ul>
          <li>
            <strong>Account details:</strong> your name, email address, and a password that is
            stored only as a salted PBKDF2 hash (we can&apos;t see it).
          </li>
          <li>
            <strong>Financial records you enter or import:</strong> transactions, categories,
            budgets, savings goals and contributions, bill reminders, and notes.
          </li>
          <li>
            <strong>Activity in the app:</strong> notification preferences and messages, questions
            you ask the AI assistant and its answers, and research-lab runs you create.
          </li>
          <li>
            <strong>Technical data:</strong> your IP address, used briefly in memory to limit
            repeated sign-in attempts, and standard request logs kept by our hosting provider.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> collect bank, card, UPI, or net-banking credentials, account
          balances, or KYC documents. FinSight has no connection to any bank or payment system.
        </p>
      </LegalSection>

      <LegalSection title="2. Why we use it">
        <ul>
          <li>To provide the service: calculating totals, budgets, forecasts, insights, and answers.</li>
          <li>To keep your account secure, including sign-in protection and password resets.</li>
          <li>To send emails you ask for, such as password reset links.</li>
        </ul>
        <p>
          We process your data on the basis of the consent you give when you create an account. We
          don&apos;t sell your data, show ads, or use it to train AI models.
        </p>
      </LegalSection>

      <LegalSection title="3. Cookies">
        <p>
          We use a single essential cookie to keep you signed in. It is HttpOnly and sent only over
          HTTPS. There are no advertising or third-party tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="4. Service providers and where data is stored">
        <p>
          To run FinSight we rely on a small number of providers who process data on our behalf:
          application hosting (Render), a managed PostgreSQL database (Neon), and an email delivery
          service (Brevo) for password-reset emails. These providers may store data on servers
          outside India.
        </p>
        <p>
          By default the AI assistant runs entirely on our own server. If a hosted AI provider is
          ever enabled, only the calculated figures needed to answer your question would be sent to
          it, and we will update this policy before that happens.
        </p>
      </LegalSection>

      <LegalSection title="5. How long we keep it">
        <p>
          We keep your data while your account exists. When you delete your account, your account
          and all of its records are removed from our live database immediately. Copies may remain
          in our database provider&apos;s short-term backups until they expire automatically.
        </p>
      </LegalSection>

      <LegalSection title="6. Your rights">
        <ul>
          <li>
            <strong>Access and portability:</strong> download all of your transactions as CSV from
            Settings at any time.
          </li>
          <li>
            <strong>Correction:</strong> edit any record directly in the app.
          </li>
          <li>
            <strong>Erasure:</strong> delete your account and all of its data from Settings →
            Account &amp; privacy.
          </li>
          <li>
            <strong>Withdraw consent:</strong> deleting your account withdraws it.
          </li>
          <li>
            <strong>Grievances:</strong> contact us using the details below and we will respond as
            soon as reasonably possible.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>
          Data is encrypted in transit with HTTPS. Every record is scoped to its owner, sessions can
          be revoked by signing out, and sign-in attempts are rate-limited. No system is perfectly
          secure; if we learn of a breach affecting your data we will notify you and the relevant
          authority as required by law.
        </p>
      </LegalSection>

      <LegalSection title="8. Children">
        <p>FinSight is intended for people aged 18 and over. Please don&apos;t create an account if you are younger.</p>
      </LegalSection>

      <LegalSection title="9. Changes and contact">
        <p>
          We will update this page if our practices change and show the new date at the top. For
          questions, data requests, or grievances, reach us at <ContactLink />. See also our{" "}
          <Link to="/terms" className="font-semibold text-primary hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
