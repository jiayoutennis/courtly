import React from "react";

/**
 * Courtly – Stripe Connect Integration Spec (for Cursor/Copilot)
 * --------------------------------------------------------------
 * This .tsx file renders the full build plan as a readable spec inside the app
 * so your agent (Cursor/Copilot) can parse, diff, or copy sections easily.
 * Keep this file co-located with your payments module (e.g., /apps/web/specs/).
 */

export default function StripeConnectSpec() {
  return (
    <div className="prose prose-invert max-w-none p-6">
      <h1>Courtly – Stripe Connect Integration Spec (for Cursor/Copilot)</h1>
      <p>
        This document is a step-by-step build plan for adding <strong>Stripe Connect (Express)</strong> to Courtly so
        club admins can collect payments for <strong>court reservations</strong> and <strong>club memberships</strong>.
        Use this as a Cursor/Copilot task guide.
      </p>

      <hr />

      <h2>0) Assumptions &amp; Stack</h2>
      <ul>
        <li><strong>Frontend:</strong> React + TypeScript (Next.js or CRA). Auth via Firebase Auth.</li>
        <li><strong>Backend:</strong> Firebase Cloud Functions (Node.js/TS) + Firestore.</li>
        <li><strong>Payments:</strong> Stripe Connect (Express) with Checkout + Webhooks.</li>
        <li><strong>Multitenancy:</strong> Each Club is a Firestore <code>clubs/{{"{clubId}"}}</code> document.</li>
        <li><strong>Roles:</strong> <code>userType</code> supports <code>club_admin</code> and <code>member</code>.</li>
      </ul>

      <h2>1) Environment &amp; Config</h2>
      <pre>
        <code>
{`STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
PLATFORM_FEE_BASIS_POINTS=300  # 3% example
APP_BASE_URL=https://courtly.app`}
        </code>
      </pre>
      <p>For test mode, use separate <code>_TEST</code> keys or a different <code>.env</code> file. Add runtime config to Functions and Frontend (provide a typed config module the app imports).</p>

      <h2>2) Firestore Schema (new/updated fields)</h2>
      <h3>Collection: <code>clubs/{{"{clubId}"}}</code></h3>
      <ul>
        <li><code>name: string</code></li>
        <li><code>stripeAccountId: string | null</code> (e.g., <code>acct_1...</code>)</li>
        <li><code>stripeStatus: 'unlinked' | 'onboarding' | 'active' | 'restricted' | 'pending_verification'</code></li>
        <li><code>stripeOnboardingComplete: boolean</code></li>
        <li><code>payoutsEnabled: boolean</code> (mirror from Stripe)</li>
        <li><code>chargesEnabled: boolean</code> (mirror from Stripe)</li>
        <li><code>supportEmail: string</code></li>
        <li><code>supportPhone: string</code></li>
        <li><code>statementDescriptor: string</code> (optional)</li>
        <li><code>country: 'US' | ...</code> (used for currency rules)</li>
        <li><code>currency: 'usd' | ...</code></li>
        <li>
          <code>reservationSettings: &#123; requirePaymentAtBooking: boolean; hourlyRateCents: number; &#125;</code>
        </li>
        <li>
          <code>
            membershipPlans: Array&lt;&#123; id: string; name: string; priceCents: number; interval: 'month'|'year'|'one_time'; active: boolean &#125;&gt;
          </code>
        </li>
        <li><code>createdAt: Timestamp</code></li>
        <li><code>updatedAt: Timestamp</code></li>
      </ul>

      <h3>Collection: <code>reservations/{{"{reservationId}"}}</code></h3>
      <ul>
        <li><code>clubId: string</code></li>
        <li><code>userId: string</code></li>
        <li><code>courtId: string</code></li>
        <li><code>start: Timestamp</code></li>
        <li><code>end: Timestamp</code></li>
        <li><code>status: 'pending'|'confirmed'|'cancelled'</code></li>
        <li><code>priceCents: number</code></li>
        <li><code>currency: string</code></li>
        <li><code>checkoutSessionId?: string</code></li>
        <li><code>paymentIntentId?: string</code></li>
        <li><code>paymentStatus: 'requires_payment'|'paid'|'refunded'|'failed'</code></li>
        <li><code>createdAt: Timestamp</code></li>
        <li><code>updatedAt: Timestamp</code></li>
      </ul>

      <h3>Collection: <code>membershipSubscriptions/{{"{subscriptionId}"}}</code></h3>
      <ul>
        <li><code>clubId: string</code></li>
        <li><code>userId: string</code></li>
        <li><code>planId: string</code></li>
        <li><code>status: 'incomplete'|'active'|'past_due'|'canceled'|'unpaid'</code></li>
        <li><code>priceCents: number</code></li>
        <li><code>interval: 'month'|'year'|'one_time'</code></li>
        <li><code>currency: string</code></li>
        <li><code>checkoutSessionId?: string</code></li>
        <li><code>subscriptionId?: string</code> (Stripe)</li>
        <li><code>latestInvoiceId?: string</code> (Stripe)</li>
        <li><code>customerId?: string</code> (Stripe)</li>
        <li><code>paymentStatus: 'requires_payment'|'paid'|'refunded'|'failed'</code></li>
        <li><code>createdAt: Timestamp</code></li>
        <li><code>updatedAt: Timestamp</code></li>
      </ul>

      <h3>Collection: <code>platformSettings/sensitive</code></h3>
      <ul>
        <li><code>platformFeeBasisPoints: number</code> (mirror env; optional)</li>
      </ul>

      <h2>3) Admin Dashboard – Connect Stripe UX</h2>
      <p><strong>Route:</strong> <code>/dashboard/club/&#123;clubId&#125;/payments</code></p>
      <p>UI states (derived from club doc):</p>
      <ul>
        <li><strong>Unlinked:</strong> Show CTA <em>“Connect Stripe Account”</em> → create Express account + Account Link. Redirect user.</li>
        <li><strong>Onboarding:</strong> Show <em>“Resume Stripe Onboarding”</em> → refresh account link.</li>
        <li><strong>Active:</strong> Show <em>“Stripe Connected ✅”</em>, plus Express Dashboard link, payouts/charges status, and verification banners if restricted.</li>
      </ul>
      <p>Buttons: <code>ConnectStripeButton</code>, <code>ResumeOnboardingButton</code>, <code>OpenStripeDashboardButton</code></p>

      <h2>4) Backend Functions (HTTPS + Webhooks)</h2>
      <h3>4.1 Create or Fetch Express Account</h3>
      <p><strong>Endpoint:</strong> <code>POST /api/payments/stripe/connect/start</code></p>
      <ul>
        <li><strong>Auth:</strong> Firebase ID token. Require <code>club_admin</code> &amp; ownership of <code>clubId</code>.</li>
        <li><strong>Body:</strong> <code>&#123; clubId: string &#125;</code></li>
        <li><strong>Logic:</strong>
          <ol>
            <li>If club has <code>stripeAccountId</code>, fetch account from Stripe; else <code>stripe.accounts.create(&#123; type: 'express' &#125;)</code>.</li>
            <li>Persist <code>stripeAccountId</code>, set <code>stripeStatus='onboarding'</code> if new.</li>
            <li>Create <code>accountLink = stripe.accountLinks.create(&#123; account, type: 'account_onboarding', refresh_url, return_url &#125;)</code>.</li>
            <li>Return <code>&#123; url: accountLink.url &#125;</code>.</li>
          </ol>
        </li>
      </ul>
      <p><strong>Return URL:</strong> <code>APP_BASE_URL/dashboard/club/&#123;clubId&#125;/payments?connected=1</code><br />
         <strong>Refresh URL:</strong> <code>APP_BASE_URL/dashboard/club/&#123;clubId&#125;/payments?refresh=1</code></p>

      <h3>4.2 Generate Dashboard Link (Express)</h3>
      <p><strong>Endpoint:</strong> <code>POST /api/payments/stripe/connect/dashboard</code></p>
      <ul>
        <li><strong>Auth:</strong> <code>club_admin</code></li>
        <li><strong>Body:</strong> <code>&#123; clubId: string &#125;</code></li>
        <li><strong>Logic:</strong> <code>stripe.accounts.createLoginLink(club.stripeAccountId)</code> → <code>&#123; url &#125;</code></li>
      </ul>

      <h3>4.3 Create Checkout Session – Reservation</h3>
      <p><strong>Endpoint:</strong> <code>POST /api/payments/stripe/checkout/reservation</code></p>
      <ul>
        <li><strong>Auth:</strong> member.</li>
        <li><strong>Body:</strong> <code>&#123; clubId, reservationId &#125;</code></li>
        <li><strong>Logic:</strong> compute amount server-side; ensure <code>chargesEnabled=true</code>; create Checkout with destination charges:
          <pre>
            <code>
{`mode: 'payment'
line_items: [{ name: 'Court Reservation', amount: priceCents, currency, quantity: 1 }]
payment_intent_data: {
  application_fee_amount: PLATFORM_FEE,
  transfer_data: { destination: club.stripeAccountId },
}
success_url: APP_BASE_URL/reservations/{reservationId}?success=1
cancel_url: APP_BASE_URL/reservations/{reservationId}?canceled=1`}
            </code>
          </pre>
        </li>
      </ul>

      <h3>4.4 Create Checkout Session – Membership</h3>
      <p><strong>Endpoint:</strong> <code>POST /api/payments/stripe/checkout/membership</code></p>
      <ul>
        <li><strong>Auth:</strong> member.</li>
        <li><strong>Body:</strong> <code>&#123; clubId, planId &#125;</code></li>
        <li><strong>Logic:</strong> lookup plan, use <code>mode: 'subscription'</code> for recurring, <code>mode: 'payment'</code> for one-time. Use Connected Account destination + platform fee. For recurring, create Products/Prices in the connected account and store <code>priceId</code>.</li>
      </ul>

      <h3>4.5 Webhooks (single handler)</h3>
      <p><strong>Endpoint:</strong> <code>POST /api/payments/stripe/webhook</code> (verify with <code>STRIPE_WEBHOOK_SECRET</code>)</p>
      <ul>
        <li><code>checkout.session.completed</code>: mark reservation <code>paid</code> &amp; <code>confirmed</code> or activate membership; store IDs.</li>
        <li><code>payment_intent.payment_failed</code>: mark <code>failed</code>.</li>
        <li><code>account.updated</code>: sync <code>chargesEnabled</code>, <code>payoutsEnabled</code>, requirements → update <code>stripeStatus</code>.</li>
        <li><code>invoice.paid</code> / <code>invoice.payment_failed</code>: update membership status.</li>
      </ul>
      <p>Ensure idempotency by storing processed event IDs in <code>stripeWebhookEvents/{{"{eventId}"}}</code>.</p>

      <h2>5) Frontend Flows</h2>
      <h3>5.1 Admin → Connect Flow</h3>
      <ol>
        <li>Admin opens Payments tab.</li>
        <li>If unlinked, press <em>Connect Stripe</em> → call <code>/connect/start</code> → redirect to <code>accountLink.url</code>.</li>
        <li>Complete onboarding on Stripe; return to app; poll <code>clubs/{{"{clubId}"}}</code> for enabled flags; show success.</li>
      </ol>

      <h3>5.2 Member → Reservation Payment</h3>
      <ol>
        <li>Member books a reservation (pending if payment required).</li>
        <li>Press <em>Pay Now</em> → call <code>/checkout/reservation</code> → redirect to Stripe Checkout.</li>
        <li>Webhook updates Firestore; UI listens and shows <strong>Confirmed</strong>.</li>
      </ol>

      <h3>5.3 Member → Membership Purchase</h3>
      <ol>
        <li>Member selects plan.</li>
        <li>Press <em>Subscribe</em> → call <code>/checkout/membership</code>.</li>
        <li>Webhook activates subscription; UI reflects status.</li>
      </ol>

      <h2>6) Design Notes (Important)</h2>
      <h3>6.1 Destination Charges vs Direct Charges</h3>
      <p>
        <strong>Destination charges</strong> (recommended) create the PaymentIntent on the platform with <code>transfer_data.destination=acct_xxx</code> and optional <code>application_fee_amount</code>. We will use destination charges for one-time and subscription initial payments.
      </p>
      <p>
        For recurring memberships, prefer <strong>(B)</strong>: create Subscriptions on the <strong>connected account</strong> with <code>application_fee_percent</code> via <code>on_behalf_of</code> + <code>transfer_data</code>. Create Price/Product once per club and store <code>priceId</code>.
      </p>

      <h3>6.2 Taxes &amp; Invoices</h3>
      <ul>
        <li>Enable Stripe Tax if required and pass <code>automatic_tax: &#123; enabled: true &#125;</code> to Checkout.</li>
        <li>Ensure statement descriptor length/format meets Stripe rules.</li>
      </ul>

      <h3>6.3 Refunds &amp; Cancellations</h3>
      <ul>
        <li>Admin UI to refund: <code>stripe.refunds.create(&#123; payment_intent &#125;)</code> then update Firestore.</li>
        <li>Cancel membership: cancel Stripe subscription; set local status.</li>
      </ul>

      <h2>7) Security &amp; Compliance</h2>
      <ul>
        <li>Verify Firebase ID token on backend.</li>
        <li>Authorize only club admins for connect/dashboard endpoints.</li>
        <li>Verify Stripe webhook signatures.</li>
        <li>Never trust client-provided prices; compute server-side.</li>
        <li>Restrict Firestore writes to payment fields via rules.</li>
      </ul>

      <h2>8) Firestore Rules (sketch)</h2>
      <pre>
        <code>
{`match /clubs/{clubId} {
  allow read: if true;
  allow update: if request.auth != null && isClubAdmin(request.auth, clubId);
}

match /reservations/{id} {
  allow read: if resource.data.clubId in userClubs(request.auth);
  allow write: if request.auth != null && canWriteReservation(request.auth, resource.data.clubId);
}

match /membershipSubscriptions/{id} {
  allow read, write: if request.auth != null && request.resource.data.userId == request.auth.uid;
}`}
        </code>
      </pre>
      <p>(Implement <code>isClubAdmin</code>, <code>userClubs</code> with custom claims or lookup.)</p>

      <h2>9) Function Stubs (Type Signatures)</h2>
      <pre>
        <code>
{`// connect/start
POST /api/payments/stripe/connect/start
Body: { clubId: string }
Resp: { url: string }

// connect/dashboard
POST /api/payments/stripe/connect/dashboard
Body: { clubId: string }
Resp: { url: string }

// checkout/reservation
POST /api/payments/stripe/checkout/reservation
Body: { clubId: string; reservationId: string }
Resp: { sessionId: string; url: string }

// checkout/membership
POST /api/payments/stripe/checkout/membership
Body: { clubId: string; planId: string }
Resp: { sessionId: string; url: string }

// webhook
POST /api/payments/stripe/webhook`}
        </code>
      </pre>

      <h2>10) Webhook Event Mapping</h2>
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>checkout.session.completed</code></td>
            <td>Update reservation/membership status to paid/active; store <code>paymentIntentId</code>, <code>customerId</code>, etc.</td>
          </tr>
          <tr>
            <td><code>payment_intent.payment_failed</code></td>
            <td>Mark document failed; notify user.</td>
          </tr>
          <tr>
            <td><code>account.updated</code></td>
            <td>Mirror <code>chargesEnabled</code>, <code>payoutsEnabled</code>, <code>requirements</code> → <code>stripeStatus</code>.</td>
          </tr>
          <tr>
            <td><code>invoice.paid</code></td>
            <td>Update subscription doc to active/current.</td>
          </tr>
          <tr>
            <td><code>invoice.payment_failed</code></td>
            <td>Mark past_due; notify member.</td>
          </tr>
        </tbody>
      </table>
      <p>Idempotency: store processed <code>event.id</code> in <code>stripeWebhookEvents/{{"{id}"}}</code>.</p>

      <h2>11) Admin UI Components (to build)</h2>
      <ul>
        <li><code>&lt;ConnectStripeCard clubId="..." /&gt;</code> – shows status; Connect/Resume/Open Dashboard</li>
        <li><code>&lt;PayoutStatusBadge /&gt;</code> – reflects <code>chargesEnabled</code>/<code>payoutsEnabled</code></li>
        <li><code>&lt;MembershipPlanEditor /&gt;</code> – creates products/prices in connected account, saves <code>priceId</code></li>
        <li><code>&lt;ReservationPaymentButton reservationId /&gt;</code> – kicks off checkout</li>
      </ul>

      <h2>12) Testing Plan</h2>
      <ol>
        <li>Connect flow creates <code>acct_xxx</code>, persists to Firestore, returns onboarding link.</li>
        <li>Resume onboarding regenerates link if expired.</li>
        <li>Reservation payment succeeds with test card <code>4242 4242 4242 4242</code> → webhook marks paid.</li>
        <li>Payment failure path marks <code>failed</code> and surfaces UI error.</li>
        <li>Membership subscription (monthly) creates subscription on connected account; invoices paid/failed reflected in Firestore.</li>
        <li><code>account.updated</code> toggles to <code>restricted</code> if verification docs missing; UI shows banner.</li>
        <li>Refund path creates Stripe refund and updates reservation doc.</li>
      </ol>

      <h2>13) Acceptance Criteria (checklist)</h2>
      <ul>
        <li>Club admin can create/connect a Stripe Express account from Payments tab.</li>
        <li>After onboarding, club shows <strong>Stripe Connected</strong> with enabled flags mirrored.</li>
        <li>Members can pay for reservations via Checkout; reservations auto-confirm on paid.</li>
        <li>Members can purchase memberships; subscriptions reflect webhook status.</li>
        <li>Platform fee deducted per env-config basis points.</li>
        <li>Webhooks verified &amp; idempotent; Firestore updates atomic &amp; secure.</li>
        <li>Admin can open Stripe Express Dashboard from app.</li>
        <li>All sensitive envs from secure config; no secrets in client.</li>
      </ul>

      <h2>14) Cursor/Copilot Task Prompts</h2>
      <p><strong>Task A — Backend endpoints</strong></p>
      <pre>
        <code>
{`Implement Firebase Functions endpoints described in §4. Use Stripe SDK, verify Firebase Auth, and Firestore. Return JSON {url} for connect/dashboard, {sessionId, url} for checkout endpoints.`}
        </code>
      </pre>
      <p><strong>Task B — Webhook handler</strong></p>
      <pre>
        <code>
{`Build /api/payments/stripe/webhook with signature verification and event routing per §10. Update Firestore documents idempotently. Log and capture errors.`}
        </code>
      </pre>
      <p><strong>Task C — Firestore schema & rules</strong></p>
      <pre>
        <code>
{`Add fields per §2. Implement rules per §8 with helpers isClubAdmin, userClubs.`}
        </code>
      </pre>
      <p><strong>Task D — Admin UI</strong></p>
      <pre>
        <code>
{`Create ConnectStripeCard per §11. Wire to endpoints. Implement status polling after return from onboarding.`}
        </code>
      </pre>
      <p><strong>Task E — Reservation/Membership Checkout</strong></p>
      <pre>
        <code>
{`Implement client actions to call checkout endpoints and redirect to url. Listen to Firestore to reflect status changes.`}
        </code>
      </pre>
      <p><strong>Task F — Membership Plan Prices</strong></p>
      <pre>
        <code>
{`When admin creates/edits a plan, ensure a Product/Price exists in the connected account and store priceId on the plan. Use stripe.products.create / stripe.prices.create with stripeAccount header targeting acct_xxx.`}
        </code>
      </pre>

      <h2>15) Monitoring &amp; Observability</h2>
      <ul>
        <li>Log function invocations with request IDs.</li>
        <li>Store webhook processing results in <code>stripeWebhookEvents</code> for audit.</li>
        <li>Add Sentry (or similar) to Functions + Frontend for error capture.</li>
      </ul>

      <h2>16) Rollout Plan</h2>
      <ol>
        <li>Ship in <strong>Test Mode</strong> behind feature flag <code>payments.enabled</code> per club.</li>
        <li>Dogfood with internal club.</li>
        <li>Migrate to <strong>Live Mode</strong> keys and rotate webhook secret.</li>
        <li>Document runbook for support (common errors + resolutions).</li>
      </ol>

      <h2>17) Common Errors &amp; Fixes</h2>
      <ul>
        <li><strong>account_link expired:</strong> regenerate with <code>/connect/start</code>.</li>
        <li><strong>chargesEnabled=false after onboarding:</strong> upload verification docs in Stripe → Settings.</li>
        <li><strong>No such price on membership checkout:</strong> ensure <code>priceId</code> created in the <em>connected account</em>, not platform.</li>
        <li><strong>Payment amount mismatch:</strong> never take amount from client; recompute server-side.</li>
      </ul>

      <h2>18) Legal/Compliance Notes (high level)</h2>
      <ul>
        <li>Include Terms/Refund policy links in Checkout.</li>
        <li>Keep PCI scope on Stripe-hosted pages only.</li>
      </ul>

      <p><em>End of Spec.</em></p>
    </div>
  );
}
