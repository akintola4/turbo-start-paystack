import type { Direction } from "../types";

const Stub = () => <main className="p-8">Direction a (stub)</main>;

const direction: Direction = {
  id: "a",
  name: "a",
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
