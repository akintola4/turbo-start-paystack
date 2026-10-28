import type { Direction } from "../types";
import { AcceptInvite } from "./accept-invite";
import { Auth } from "./auth";
import { Billing } from "./billing";
import { Dashboard } from "./dashboard";
import { Landing } from "./landing";
import { Members } from "./members";
import { OrgPicker } from "./org-picker";
import { AppShell } from "./shell";
import { ConfirmingPayment, NotFound, PageLoading } from "./states";

const direction: Direction = {
  id: "c",
  name: "Market",
  Landing,
  Auth,
  AcceptInvite,
  OrgPicker,
  AppShell,
  Dashboard,
  Members,
  Billing,
  PageLoading,
  ConfirmingPayment,
  NotFound,
};

export default direction;
