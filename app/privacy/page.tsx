import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — MicroGRID Energy',
  description: 'How MicroGRID Energy collects, uses, and protects your personal data.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: April 9, 2026</p>

        <Section title="Overview">
          <p>
            MicroGRID Energy (&quot;MicroGRID&quot;, &quot;we&quot;, &quot;us&quot;) provides residential
            solar installation services and a customer portal mobile app for our customers to
            monitor their installations, communicate with our team, and manage their accounts.
            This policy explains what data we collect, how we use it, who we share it with, and
            your rights regarding your data.
          </p>
          <p>
            This policy applies to the MicroGRID iOS app and to our website at
            gomicrogridenergy.com.
          </p>
        </Section>

        <Section title="What We Collect">
          <p>
            When you sign up for solar installation with MicroGRID, and when you use the
            MicroGRID customer portal app, we collect:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Identity and contact information</strong> — your name, email address,
              phone number, and the physical address of your solar installation. You provide
              this when you sign a contract for solar installation with us.
            </li>
            <li>
              <strong>Project information</strong> — details about your solar system, including
              system size, equipment, financing details, and installation status.
            </li>
            <li>
              <strong>Solar production data</strong> — energy generation data from your
              installed system.
            </li>
            <li>
              <strong>In-app communications</strong> — messages you send to our support team,
              support tickets you create, and feedback you submit (including any screenshots
              you choose to attach).
            </li>
            <li>
              <strong>Push notification tokens</strong> — when you grant notification
              permission, we collect an Apple Push Notification token so we can send you
              updates about your installation.
            </li>
            <li>
              <strong>Technical context with feedback</strong> — when you submit feedback
              through the app, we automatically include your device type, operating system
              version, app version, and the screen you were on. This is collected only at the
              moment you submit feedback, never in the background.
            </li>
          </ul>
        </Section>

        <Section title="What We Do NOT Collect">
          <ul className="list-disc pl-6 space-y-2">
            <li>We do not use third-party advertising or marketing analytics.</li>
            <li>
              We do not track your location outside the installation address you provided.
            </li>
            <li>
              We do not access your contacts, photos, or files except when you explicitly
              attach them to feedback.
            </li>
            <li>We do not sell your data to anyone, ever.</li>
          </ul>
        </Section>

        <Section title="How We Use Your Data">
          <ul className="list-disc pl-6 space-y-2">
            <li>To install, monitor, and service your solar system</li>
            <li>
              To communicate with you about your installation, billing, and support requests
            </li>
            <li>
              To send you push notifications about installation milestones and responses to
              your feedback
            </li>
            <li>To improve our service based on the feedback you submit</li>
            <li>
              To meet our legal and regulatory obligations (tax records, warranty records,
              contract documentation)
            </li>
          </ul>
        </Section>

        <Section title="Who We Share It With">
          <p>
            We share data only with service providers necessary to operate the MicroGRID
            platform:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Supabase</strong> — database hosting (United States)
            </li>
            <li>
              <strong>Resend</strong> — transactional email delivery (United States)
            </li>
            <li>
              <strong>Apple Push Notification Service</strong> — push notification routing
            </li>
            <li>
              <strong>Vercel</strong> — web hosting (United States)
            </li>
            <li>
              <strong>Sentry</strong> — error and crash reporting for our internal CRM
            </li>
          </ul>
          <p>
            We may share data with trusted partners involved in your specific installation
            (financing companies, electricians, roofers, AHJ permitting offices) when necessary
            to complete your project. We may share data when legally required (subpoena, court
            order, regulatory compliance).
          </p>
          <p>We do not sell your data to data brokers, advertisers, or any third party.</p>
        </Section>

        <Section title="Data Retention and Deletion">
          <p>
            <strong>Your portal account.</strong> You can delete your customer portal account
            at any time from inside the MicroGRID app: Account → Delete Account. Deletion is
            immediate and permanent. It removes your portal account, in-app feedback,
            referrals, billing portal data, and any saved payment methods.
          </p>
          <p>
            <strong>Underlying installation records.</strong> We retain the records of your
            solar installation itself — your contract, system design, installation photos,
            warranty documentation, and customer service history — for the operational life of
            the installation and as required by applicable law (typically 7 to 25 years
            depending on the document type). This is industry standard and is required to
            honor your warranty, service your system, and comply with tax and regulatory
            obligations.
          </p>
          <p>
            <strong>Customer-support communications.</strong> Messages between you and our
            support team are retained as part of our service records, even after your portal
            account is deleted, in case warranty or service questions arise later.
          </p>
        </Section>

        <Section title="Your Rights">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>View your data</strong> — your personal data is visible inside the
              MicroGRID app under the Account tab.
            </li>
            <li>
              <strong>Request a copy</strong> — email greg@gomicrogridenergy.com and we will
              send you a copy of your data.
            </li>
            <li>
              <strong>Correct your data</strong> — email us if any of your contact or
              installation information is incorrect.
            </li>
            <li>
              <strong>Delete your account</strong> — open the MicroGRID app and go to Account →
              Delete Account. You can also email us to request deletion.
            </li>
            <li>
              <strong>Opt out of notifications</strong> — disable push notifications in iOS
              Settings → MicroGRID → Notifications.
            </li>
          </ul>
        </Section>

        <Section title="Children's Privacy">
          <p>
            MicroGRID is not intended for use by children under 13. We do not knowingly collect
            data from children. If you believe a child has provided us with data, contact us
            and we will delete it.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this policy from time to time. The &quot;Last updated&quot; date at
            the top reflects the most recent change. Material changes will be communicated
            through the app or via email to your registered address.
          </p>
        </Section>

        <Section title="Contact">
          <p>Questions about this policy or your data?</p>
          <p>
            <strong>MicroGRID Energy</strong>
            <br />
            27510 Whispering Maple Way
            <br />
            Spring, TX 77386
            <br />
            <a
              href="mailto:greg@gomicrogridenergy.com"
              className="text-green-400 hover:underline"
            >
              greg@gomicrogridenergy.com
            </a>
          </p>
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-3 text-green-400">{title}</h2>
      <div className="space-y-3 text-gray-300 leading-relaxed">{children}</div>
    </section>
  )
}
