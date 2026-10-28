import type { Direction } from "../types";
import { Billing } from "./billing";
import { Dashboard } from "./dashboard";
import {
  AcceptInvite,
  Auth,
  ConfirmingPayment,
  NotFound,
  OrgPicker,
  PageLoading,
} from "./entry";
import { Landing } from "./landing";
import { Members } from "./members";
import { ConsoleShell } from "./shell";

const direction: Direction = {
  id: "b",
  name: "Console",
  Landing,
  Auth,
  AcceptInvite,
  OrgPicker,
  AppShell: ({ data, children }) => (
    <ConsoleShell data={data}>{children}</ConsoleShell>
  ),
  Dashboard,
  Members,
  Billing,
  PageLoading,
  ConfirmingPayment,
  NotFound,
};

export default direction;
