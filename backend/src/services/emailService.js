const config = require('../config/env');
const https = require('https');

// Send email via Resend API or graceful mock logger
async function sendEmail({ to, subject, html }) {
  if (!config.resend.apiKey) {
    console.log(`[Notification Engine] Email dispatched (Dev Log) -> To: ${to} | Subject: "${subject}"`);
    return { success: true, simulated: true };
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      from: config.resend.fromEmail,
      to: [to],
      subject: subject,
      html: html
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.resend.apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data });
        } else {
          console.warn('[Resend API] Delivery issue:', data);
          resolve({ success: false, error: data });
        }
      });
    });

    req.on('error', (err) => {
      console.warn('[Resend API] Request error:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Resend request timeout' });
    });

    req.write(postData);
    req.end();
  });
}

// Pre-built email templates for civic events
function getRegistrationConfirmationTemplate(name, complaintId, title, category) {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #172554; margin: 0;">CivicPulse Municipal Platform</h2>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Report. Track. Resolve. Build a Better City.</p>
      </div>
      <p style="color: #334155; font-size: 16px;">Hello <strong>${name}</strong>,</p>
      <p style="color: #475569; line-height: 1.6;">Your civic grievance has been successfully registered on the CivicPulse portal. Our civic municipal administration has acknowledged the submission.</p>
      
      <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 4px 0;"><strong>Complaint ID:</strong> <span style="color: #1d4ed8; font-weight: bold;">${complaintId}</span></p>
        <p style="margin: 4px 0;"><strong>Category:</strong> ${category}</p>
        <p style="margin: 4px 0;"><strong>Title:</strong> ${title}</p>
        <p style="margin: 4px 0;"><strong>Initial Status:</strong> <span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">Pending Review</span></p>
      </div>

      <p style="color: #475569;">You can track real-time inspection, department assignment, and before-and-after photo resolution anytime directly from your dashboard.</p>
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="${config.frontendUrl}/citizen-dashboard.html" style="background: #0d9488; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: 600; display: inline-block;">Open CivicPulse Dashboard</a>
      </div>

      <div style="margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 15px; color: #94a3b8; font-size: 12px; text-align: center;">
        CivicPulse Smart Accountability Network &bull; University Innovation Initiative
      </div>
    </div>
  `;
}

function getStatusUpdateTemplate(name, complaintId, title, oldStatus, newStatus, remarks) {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #172554; margin: 0;">CivicPulse Status Update</h2>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Complaint #${complaintId}</p>
      </div>
      <p style="color: #334155; font-size: 16px;">Hello <strong>${name}</strong>,</p>
      <p style="color: #475569; line-height: 1.6;">There is a progress update on your reported civic issue: <strong>"${title}"</strong>.</p>
      
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 4px 0;"><strong>Status Changed:</strong> <span style="text-decoration: line-through; color: #64748b;">${oldStatus}</span> &rarr; <strong style="color: #15803d; font-size: 16px;">${newStatus}</strong></p>
        ${remarks ? `<p style="margin: 8px 0 0 0; color: #334155;"><strong>Official Remarks:</strong> "${remarks}"</p>` : ''}
      </div>

      <p style="color: #475569;">Visit your dashboard to inspect full timeline milestones and resolution photos.</p>
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="${config.frontendUrl}/citizen-dashboard.html" style="background: #172554; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: 600; display: inline-block;">View Live Timeline</a>
      </div>
    </div>
  `;
}

module.exports = {
  sendEmail,
  getRegistrationConfirmationTemplate,
  getStatusUpdateTemplate
};
