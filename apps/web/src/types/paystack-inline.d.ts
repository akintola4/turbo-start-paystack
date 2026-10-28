declare module "@paystack/inline-js" {
  type Callbacks = {
    onSuccess?: (transaction: { reference: string; status?: string }) => void;
    onCancel?: () => void;
    onError?: (error: { message: string }) => void;
    onLoad?: () => void;
  };
  export default class PaystackPop {
    resumeTransaction(accessCode: string, callbacks?: Callbacks): unknown;
  }
}
