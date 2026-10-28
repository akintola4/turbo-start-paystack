import type { Direction } from "../types";
import { LedgerAuth } from "./auth";
import { LedgerBilling } from "./billing";
import { LedgerDashboard } from "./dashboard";
import { LedgerLanding } from "./landing";
import { LedgerMembers } from "./members";
import {
  LedgerAcceptInvite,
  LedgerConfirmingPayment,
  LedgerNotFound,
  LedgerOrgPicker,
  LedgerPageLoading,
} from "./misc";
import { LedgerShell } from "./shell";

/** Direction A, "Ledger": the app as a financial statement. */
const direction: Direction = {
  id: "a",
  name: "Ledger",
  Landing: LedgerLanding,
  Auth: LedgerAuth,
  AcceptInvite: LedgerAcceptInvite,
  OrgPicker: LedgerOrgPicker,
  AppShell: LedgerShell,
  Dashboard: LedgerDashboard,
  Members: LedgerMembers,
  Billing: LedgerBilling,
  PageLoading: LedgerPageLoading,
  ConfirmingPayment: LedgerConfirmingPayment,
  NotFound: LedgerNotFound,
};

export default direction;
