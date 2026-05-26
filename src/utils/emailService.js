/**
 * emailService.js — browser-side email via EmailJS REST API.
 *
 * EmailJS lets you send email directly from the browser without a backend.
 * Set up at https://emailjs.com (free tier: 200 emails/month).
 *
 * Required EmailJS template variables (set these in your template):
 *   {{to_email}}   — recipient email address
 *   {{to_name}}    — recipient display name
 *   {{from_name}}  — sender display name
 *   {{subject}}    — email subject line
 *   {{message}}    — email body / message content
 *   {{reply_to}}   — reply-to address (optional)
 */

const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send'

/**
 * Send one email via EmailJS.
 * @param {object} cfg   - { serviceId, templateId, publicKey }
 * @param {object} params - { to, toName, fromName, subject, message, replyTo? }
 * @returns {Promise<void>} Resolves on success, rejects with Error on failure.
 */
export async function sendEmail(cfg, { to, toName, fromName, subject, message, replyTo = '' }) {
  if (!cfg?.serviceId || !cfg?.templateId || !cfg?.publicKey) {
    throw new Error('EMAIL_NOT_CONFIGURED')
  }
  if (!to) throw new Error('No recipient email address provided.')

  const res = await fetch(EMAILJS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id:  cfg.serviceId,
      template_id: cfg.templateId,
      user_id:     cfg.publicKey,
      template_params: {
        to_email:  to,
        to_name:   toName  || to,
        from_name: fromName || 'Youtopia Dance Academy',
        subject,
        message,
        reply_to:  replyTo,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.status)
    throw new Error(`Email failed (${res.status}): ${body}`)
  }
}

/**
 * Send the same email to multiple recipients one at a time.
 * Returns { sent: number, failed: Array<{email, error}> }
 */
export async function sendEmailToMany(cfg, recipients, params) {
  const results = { sent: 0, failed: [] }
  for (const { email, name } of recipients) {
    try {
      await sendEmail(cfg, { ...params, to: email, toName: name })
      results.sent++
    } catch (err) {
      results.failed.push({ email, error: err.message })
    }
  }
  return results
}

/** True if EmailJS credentials are all filled in. */
export function isEmailConfigured(cfg) {
  return !!(cfg?.serviceId?.trim() && cfg?.templateId?.trim() && cfg?.publicKey?.trim())
}
