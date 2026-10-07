// Ported from the frontend's src/utils/emailTemplates.ts so sent emails match the preview.
// Keep the two in sync when changing a layout.
import type { EmailTemplateId } from '../constants/options';

export interface TemplateVars {
  name: string;
  email: string;
  company: string;
  designation: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  address: string;
  ticketCode: string;
  organizer: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const fillPlaceholders = (text: string, vars: TemplateVars, escape = true) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key as keyof TemplateVars];
    if (value === undefined) return match;
    return escape ? escapeHtml(value) : value;
  });

interface RenderOptions {
  bodyHtml: string;
  vars: TemplateVars;
  qrDataUrl: string | null;
}

const FONT = "font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;";

const detailRow = (label: string, value: string, labelColor: string, valueColor: string) => `
  <tr>
    <td style="padding:6px 0;${FONT}font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${labelColor};width:110px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;${FONT}font-size:14px;color:${valueColor};font-weight:600;">${value}</td>
  </tr>`;

const qrBlock = (qr: string | null, ticket: string, border: string, text: string) =>
  qr
    ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:28px auto 8px;border:1px dashed ${border};border-radius:14px;">
        <tr><td style="padding:18px 22px;text-align:center;">
          <img src="${qr}" width="240" height="240" alt="Entry QR code" style="display:block;margin:0 auto;max-width:100%;height:auto;" />
          <div style="${FONT}font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${text};margin-top:10px;">Entry pass</div>
          <div style="font-family:JetBrains Mono,Consolas,monospace;font-size:15px;font-weight:600;color:${text};margin-top:2px;">${ticket}</div>
        </td></tr>
      </table>`
    : '';

const shell = (bg: string, inner: string) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  .content p{margin:0 0 14px;} .content ul,.content ol{margin:0 0 14px;padding-left:22px;}
  .content h2{font-size:20px;margin:0 0 12px;} .content h3{font-size:16px;margin:0 0 10px;}
  .content blockquote{margin:0 0 14px;padding-left:14px;border-left:3px solid #CBD5E1;color:#475569;}
  .content a{color:#0E7C7B;}
</style></head>
<body style="margin:0;padding:32px 12px;background:${bg};">
  <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
    <tr><td>${inner}</td></tr>
  </table>
</body></html>`;

const footer = (color: string, organizer: string) => `
  <p style="${FONT}font-size:12px;color:${color};text-align:center;margin:20px 0 0;">
    Sent by ${organizer} via EventSphere · Please do not share your QR pass.
  </p>`;

export const renderEmail = (templateId: EmailTemplateId, { bodyHtml, vars, qrDataUrl }: RenderOptions) => {
  const body = fillPlaceholders(bodyHtml, vars);
  const v = Object.fromEntries(
    Object.entries(vars).map(([k, val]) => [k, escapeHtml(val)]),
  ) as unknown as TemplateVars;
  const content = `<div class="content" style="${FONT}font-size:15px;line-height:1.65;color:#334155;">${body}</div>`;

  switch (templateId) {
    case 'elegant':
      return shell(
        '#EDEFF3',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#0F1B2D;padding:40px 40px 34px;text-align:center;">
            <div style="${FONT}font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:#D4A437;">You are cordially invited</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;color:#FFFFFF;margin-top:14px;line-height:1.25;">${v.eventTitle}</div>
            <div style="width:56px;height:2px;background:#D4A437;margin:18px auto 0;"></div>
          </td></tr>
          <tr><td style="padding:36px 40px 12px;">${content}</td></tr>
          <tr><td style="padding:0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E9DDBE;border-bottom:1px solid #E9DDBE;padding:10px 0;">
              ${detailRow('Date', v.eventDate, '#A8842B', '#0F1B2D')}
              ${detailRow('Time', v.eventTime, '#A8842B', '#0F1B2D')}
              ${detailRow('Address', v.address, '#A8842B', '#0F1B2D')}
            </table>
          </td></tr>
          <tr><td style="padding:0 40px 36px;">${qrBlock(qrDataUrl, v.ticketCode, '#D4A437', '#0F1B2D')}</td></tr>
        </table>
        ${footer('#8792A2', v.organizer)}`,
      );

    case 'modern':
      return shell(
        '#F1F5F9',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E3E8EF;">
          <tr><td style="height:6px;background:#0E7C7B;"></td></tr>
          <tr><td style="padding:34px 40px 8px;">
            <div style="${FONT}font-size:12px;font-weight:600;color:#0E7C7B;letter-spacing:.06em;text-transform:uppercase;">Invitation</div>
            <div style="${FONT}font-size:28px;font-weight:700;color:#16202E;margin-top:6px;line-height:1.25;">${v.eventTitle}</div>
          </td></tr>
          <tr><td style="padding:18px 40px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:12px;">
              <tr>
                <td style="padding:14px 16px;${FONT}width:33%;"><div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.06em;">Date</div><div style="font-size:14px;font-weight:600;color:#16202E;margin-top:2px;">${v.eventDate}</div></td>
                <td style="padding:14px 16px;${FONT}width:33%;border-left:1px solid #E3E8EF;"><div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.06em;">Time</div><div style="font-size:14px;font-weight:600;color:#16202E;margin-top:2px;">${v.eventTime}</div></td>
                <td style="padding:14px 16px;${FONT}width:34%;border-left:1px solid #E3E8EF;"><div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.06em;">Address</div><div style="font-size:14px;font-weight:600;color:#16202E;margin-top:2px;">${v.address}</div></td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:22px 40px 8px;">${content}</td></tr>
          <tr><td style="padding:0 40px 36px;">${qrBlock(qrDataUrl, v.ticketCode, '#0E7C7B', '#16202E')}</td></tr>
        </table>
        ${footer('#94A3B8', v.organizer)}`,
      );

    case 'celebration':
      return shell(
        '#FDF6EE',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(232,121,90,.15);">
          <tr><td style="background:linear-gradient(135deg,#E8795A,#F6C85F);background-color:#E8795A;padding:44px 40px;text-align:center;">
            <div style="${FONT}font-size:14px;color:#FFFFFF;letter-spacing:.3em;">✦ ✦ ✦</div>
            <div style="${FONT}font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#FFF7ED;margin-top:12px;">Join the celebration</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:32px;color:#FFFFFF;margin-top:10px;line-height:1.25;">${v.eventTitle}</div>
            <div style="${FONT}font-size:15px;color:#FFF7ED;margin-top:12px;font-weight:500;">${v.eventDate} · ${v.eventTime}</div>
          </td></tr>
          <tr><td style="padding:36px 40px 4px;">${content}</td></tr>
          <tr><td style="padding:0 40px;text-align:center;">
            <div style="display:inline-block;background:#FFF3E8;border-radius:999px;padding:10px 20px;${FONT}font-size:14px;color:#B4532F;font-weight:600;">📍 ${v.address}</div>
          </td></tr>
          <tr><td style="padding:0 40px 36px;">${qrBlock(qrDataUrl, v.ticketCode, '#E8795A', '#B4532F')}</td></tr>
        </table>
        ${footer('#B08D7A', v.organizer)}`,
      );

    case 'blank':
    default:
      return shell(
        '#F4F6F9',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;border:1px solid #E3E8EF;">
          <tr><td style="padding:36px 40px 8px;">${content}</td></tr>
          <tr><td style="padding:0 40px 32px;">${qrBlock(qrDataUrl, v.ticketCode, '#CBD5E1', '#16202E')}</td></tr>
        </table>
        ${footer('#94A3B8', v.organizer)}`,
      );
  }
};
