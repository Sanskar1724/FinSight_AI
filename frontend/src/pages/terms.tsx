import { Link } from "react-router-dom";

import { ContactLink, LegalLayout, LegalSection } from "@/components/legal-layout";

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro={
        <p>
          These terms apply when you use FinSight AI. By creating an account you agree to them and to
          our{" "}
          <Link to="/privacy" className="font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>
          . FinSight is currently a free public beta.
        </p>
      }
    >
      <LegalSection title="1. What FinSight is, and isn't">
        <p>
          FinSight is a planning and analysis tool for records you enter yourself. It is not a bank,
          lender, payment service, or registered investment, tax, or legal adviser. Insights,
          forecasts, scenarios, and AI answers are educational estimates based on your records, not
          financial advice or guarantees. Make important decisions with a qualified professional.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <ul>
          <li>You must be 18 or older and give accurate sign-up information.</li>
          <li>Keep your password private. You are responsible for activity under your account.</li>
          <li>The shared demo account is public, contains fictional data, and is reset regularly. Don&apos;t enter real information into it.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Your data">
        <p>
          You own the records you enter. You give us permission to store and process them only to
          provide the service to you. You can export or delete them at any time, as described in the
          Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p>Don&apos;t misuse the service. In particular, don&apos;t:</p>
        <ul>
          <li>try to access other people&apos;s accounts or data;</li>
          <li>probe, overload, or disrupt the service, or bypass its security or rate limits;</li>
          <li>use automated scripts to create accounts or scrape the service;</li>
          <li>upload unlawful content or content you don&apos;t have the right to use.</li>
        </ul>
        <p>We may suspend accounts that break these rules.</p>
      </LegalSection>

      <LegalSection title="5. Beta service">
        <p>
          FinSight is provided free and &quot;as is&quot; during the beta. Features may change,
          and the service may be unavailable at times or discontinued. If we plan to shut it down,
          we will give reasonable notice so you can export your data. Please keep your own copy of
          anything important.
        </p>
      </LegalSection>

      <LegalSection title="6. Liability">
        <p>
          To the extent permitted by law, FinSight and its developer are not liable for indirect or
          consequential losses, or for decisions you make based on information in the app. Nothing
          in these terms limits rights you have under applicable consumer protection law.
        </p>
      </LegalSection>

      <LegalSection title="7. Ending your use">
        <p>You can stop using FinSight and delete your account at any time from Settings.</p>
      </LegalSection>

      <LegalSection title="8. Governing law, changes, and contact">
        <p>
          These terms are governed by the laws of India. If we change them, we will update this page
          and the date at the top; continuing to use FinSight means you accept the updated terms.
          Questions? Reach us at <ContactLink />.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
