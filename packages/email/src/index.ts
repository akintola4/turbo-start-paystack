export { formatDate, formatMoney } from "./format";
export {
  appLink,
  paystackLink,
  requireAppOrigin,
  UnsafeLinkError,
} from "./links";
export {
  type AuthMailer,
  createMailer,
  idempotencyKey,
  type Mailer,
  type MailerOptions,
} from "./mailer";
export { type RenderedEmail, renderEmail } from "./render";
export type { TemplateName, TemplateProps } from "./templates/index";
export { templates } from "./templates/index";
export {
  createTheme,
  defaultTheme,
  type EmailTheme,
  type EmailThemeOverrides,
} from "./theme";
export {
  createEmailSender,
  type EmailMessage,
  type EmailSender,
  getDevOutbox,
  textToHtml,
} from "./transport";
