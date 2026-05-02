export interface RenderedEmail {
  subject: string;
  text: string;
}

interface VerificationEmailArgs {
  email: string;
  link: string;
  expiresMinutes: number;
}

interface ContractActionEmailArgs {
  actionLabel: string;
  actorRole: "client" | "provider" | "unknown";
  projectTitle: string;
  contractAddress: string;
  chainId: number;
  txHash: string;
  appUrl: string;
  itemLabel?: string;
  amountLabel?: string;
}

export function renderVerificationEmail(args: VerificationEmailArgs): RenderedEmail {
  return {
    subject: "Verify your DealLock email",
    text: [
      "Verify your DealLock email",
      "",
      `Confirm ${args.email} for DealLock notifications.`,
      `This link expires in ${args.expiresMinutes} minutes.`,
      "",
      `Verify email: ${args.link}`,
      "",
      "Email is only used for product notifications. Wallet signatures still control DealLock funds and contract actions.",
    ].join("\n"),
  };
}

export function renderContractActionEmail(args: ContractActionEmailArgs): RenderedEmail {
  const title = args.projectTitle.trim() || "DealLock agreement";
  const item = args.itemLabel ? `\nItem: ${args.itemLabel}` : "";
  const amount = args.amountLabel ? `\nAmount: ${args.amountLabel}` : "";
  const actor =
    args.actorRole === "client"
      ? "The client"
      : args.actorRole === "provider"
        ? "The provider"
        : "A contract party";
  return {
    subject: `DealLock update: ${args.actionLabel}`,
    text: [
      "DealLock agreement update",
      "",
      `${actor} completed an on-chain action: ${args.actionLabel}.`,
      `Agreement: ${title}`,
      `Contract: ${args.contractAddress}`,
      `Chain ID: ${args.chainId}`,
      `Transaction: ${args.txHash}${item}${amount}`,
      "",
      `Open DealLock: ${args.appUrl}`,
      "",
      "This notification is best-effort and does not change on-chain permissions or fund custody.",
    ].join("\n"),
  };
}
