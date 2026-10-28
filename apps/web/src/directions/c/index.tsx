import type { Direction } from "../types";

const Stub = () => <main className="p-8">Direction c (stub)</main>;

const direction: Direction = {
  id: "c",
  name: "c",
  Landing: Stub,
  Auth: Stub,
  AcceptInvite: Stub,
  OrgPicker: Stub,
  AppShell: ({ children }) => <div className="p-8">{children}</div>,
  Dashboard: Stub,
  Members: Stub,
  Billing: Stub,
  PageLoading: Stub,
  ConfirmingPayment: Stub,
  NotFound: Stub,
};

export default direction;
