export const runtime = "nodejs";

import nodemailer from 'nodemailer';
import { prisma, ensurePrismaConnected } from '../../../../../lib/prismaClient.js';

function buildTransport() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || 'safesencewinwinlabs@gmail.com';
  const pass = process.env.SMTP_PASS || 'tprw plda fxec pzqt';
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

export async function POST(request) {
  try {
    // Simple auth for cron/job
    const secret = request.headers.get('x-alerts-secret');
    if (!secret || secret !== (process.env.ALERTS_CRON_SECRET || 'dev-secret')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    await ensurePrismaConnected();

    // Find sensors currently in alert with email alerts enabled
    const sensors = await prisma.$queryRaw`
      select s.sensor_id, s.sensor_name, s.metric, s.latest_temp, s.device_id, d.owner_id
      from public.sensors s
      join public.devices d on d.device_id = s.device_id
      where s.status = 'alert'::public.sensor_status and coalesce(s.email_alert, false) = true
    `;

    if (!Array.isArray(sensors) || sensors.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Build map of last sent within 30 minutes to avoid spamming
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const cutoffIso = cutoff.toISOString();
    const recent = await prisma.$queryRaw`
      select sensor_id, max(notified_at) as last
      from public.sensor_alert_log
      where status = 'alert'::public.sensor_status and category = 'value' and notified_at >= ${cutoffIso}
      group by sensor_id
    `;
    const recentlyNotified = new Set((recent || []).map(r => String(r.sensor_id)));

    const toNotify = sensors.filter(s => !recentlyNotified.has(String(s.sensor_id)));
    if (toNotify.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Fetch recipients: owner + accepted team members with emailAlert enabled
    const ownerIds = toNotify.map(s => s.owner_id);
    const owners = await prisma.$queryRaw`
      select id, email from auth.users where id in (${prisma.join(ownerIds)})
    `;
    const ownerEmailById = new Map((owners || []).map(o => [String(o.id), String(o.email)]));

    const sensorIds = toNotify.map(s => s.sensor_id);
    const invitees = await prisma.teamInvitation.findMany({
      where: { sensorId: { in: sensorIds }, status: 'accepted', emailAlert: true },
      select: { sensorId: true, email: true }
    });
    const extraEmailsBySensor = new Map();
    for (const inv of invitees) {
      const key = String(inv.sensorId);
      const list = extraEmailsBySensor.get(key) || [];
      if (inv.email) list.push(String(inv.email));
      extraEmailsBySensor.set(key, list);
    }

    const transporter = buildTransport();
    await transporter.verify().catch(() => {});

    let sentCount = 0;
    for (const s of toNotify) {
      const ownerEmail = ownerEmailById.get(String(s.owner_id));
      const extras = extraEmailsBySensor.get(String(s.sensor_id)) || [];
      const recipients = [ownerEmail, ...extras].filter(Boolean);
      if (recipients.length === 0) continue;

      const unit = s.metric === '%' ? '%' : '°F';
      const current = s.latest_temp != null ? `${Number(s.latest_temp).toFixed(1)}${unit}` : 'N/A';
      const subject = `Critical: ${s.sensor_name || s.sensor_id} needs attention`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="margin: 0 0 16px;">Critical (Needs Attention)</h2>
          <p style="margin:0 0 12px;">Sensor <strong>${s.sensor_name || s.sensor_id}</strong> is now in a critical state.</p>
          <p style="margin:0 0 12px;">Current reading: <strong>${current}</strong></p>
          <p style="margin:0; color:#6b7280; font-size: 12px;">You can adjust thresholds in the Alerts page.</p>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: { name: process.env.SMTP_FROM_NAME || 'SafeSense Alerts', address: process.env.SMTP_FROM || (process.env.SMTP_USER || 'safesencewinwinlabs@gmail.com') },
          to: recipients.join(', '),
          subject,
          html
        });
        sentCount += recipients.length;
        await prisma.sensor_alert_log.create({
          data: { sensor_id: String(s.sensor_id), status: 'alert', category: 'value', stint_start: new Date(), notified_at: new Date() }
        }).catch(() => {});
      } catch (e) {
        // Continue other emails on error
        console.error('Failed to send alert email for sensor', s.sensor_id, e?.message || e);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('alerts notify error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}


