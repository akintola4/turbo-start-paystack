import type { Direction } from "../types";

const Stub = () => <main className="p-8">Direction b (stub)</main>;

const direction: Direction = {
  id: "b",
  name: "b",
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
