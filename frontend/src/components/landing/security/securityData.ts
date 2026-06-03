/*
 * securityData.ts — content for the Security section's code showcase.
 *
 * The tabs are SECURITY CONCEPTS, not currencies — "Native ETH", "ERC-20 assets",
 * "Release rules" — so the panel reassures about escrow logic rather than looking
 * like a token dashboard. USDC is mentioned only as an example inside the ERC-20
 * tab (it has no tab of its own; on-chain it is just an ERC-20).
 *
 * Every code excerpt is taken from the REAL `contracts/DealLockMultiAssetV2.sol`
 * (which is `contractVersion() == 6` — the "V2" in the filename is the second
 * generation of the multi-asset contract, not protocol v2). Elisions are marked
 * with `// ...`; the visible lines match the source verbatim. That fidelity is the
 * point: the code panel is the technical proof layer.
 *
 * To add/adjust a tab, edit one entry here — the tabs, panel, highlighter, and
 * metadata strip all render straight from this array (no duplicated UI).
 */

export type TabKey = "nativeEth" | "erc20" | "release";
export type CodeLang = "solidity" | "typescript";

export interface TabMeta {
  label: string;
  value: string;
}

export interface SecurityTab {
  key: TabKey;
  /** Tab button label. */
  label: string;
  /** One-line description shown under the tab row. */
  blurb: string;
  /** Source path shown in the panel's file bar. */
  file: string;
  lang: CodeLang;
  /** Small badge in the panel head. */
  badge: string;
  code: string;
  /** The metadata strip beneath the code. */
  meta: [TabMeta, TabMeta, TabMeta];
}

// Public repository URL. Placeholder until the repo is published — swap this one
// constant (or pass `repoUrl` into <SecuritySection/>) and every CTA updates.
export const REPO_URL = "https://github.com/deallock/deallock";

// Trim a leading newline + trailing whitespace so snippets can be authored as
// readable indented template literals without a blank first line.
const snip = (s: string): string => s.replace(/^\n/, "").replace(/\s+$/, "");

export const SECURITY_TABS: SecurityTab[] = [
  {
    key: "nativeEth",
    label: "Native ETH",
    blurb: "ETH is escrowed by the contract itself — no token, no allowance.",
    file: "contracts/DealLockMultiAssetV2.sol",
    lang: "solidity",
    badge: "Sepolia",
    meta: [
      { label: "Network", value: "Ethereum · Sepolia" },
      { label: "Decimals", value: "18" },
      { label: "Funding", value: "msg.value" },
    ],
    code: snip(`
// DealLockMultiAssetV2.sol — the current escrow (contractVersion() == 6).
// Native ETH is escrowed by the contract itself — no token, no allowance.

function isNativePayment() public view returns (bool) {
    return paymentToken == address(0);   // address(0) means native ETH
}

function _collectPayment(uint256 amount) internal {
    if (isNativePayment()) {
        // The client funds with msg.value; the ETH is now held on-chain
        // and can only leave through an approved milestone release.
        require(msg.value == amount, "Incorrect funding amount");
        return;
    }
    // ...ERC-20 path below
}
`),
  },
  {
    key: "erc20",
    label: "ERC-20 assets",
    blurb: "Any ERC-20 — USDC included — via one guarded transfer path.",
    file: "contracts/DealLockMultiAssetV2.sol",
    lang: "solidity",
    badge: "Extensible",
    meta: [
      { label: "Type", value: "ERC-20" },
      { label: "Example", value: "USDC (6 dp)" },
      { label: "Funding", value: "allowance + transferFrom" },
    ],
    code: snip(`
// DealLockMultiAssetV2.sol — every ERC-20 takes ONE guarded path.
// USDC is just an example ERC-20 — no per-token special-casing.

require(msg.value == 0, "ETH not accepted");
IERC20 token = IERC20(paymentToken);

// The client approves an allowance first; the contract then pulls the
// tokens with transferFrom and verifies the balance actually moved.
uint256 beforeBalance = token.balanceOf(address(this));
token.safeTransferFrom(client, address(this), amount);
uint256 afterBalance = token.balanceOf(address(this));

// Balance-delta check rejects fee-on-transfer / rebasing tokens.
// (Token decimals — e.g. USDC's 6 — are a display concern, handled in the UI.)
require(afterBalance - beforeBalance == amount, "Unsupported token transfer");
`),
  },
  {
    key: "release",
    label: "Release rules",
    blurb: "Funds move only through contract actions — approve or refund.",
    file: "contracts/DealLockMultiAssetV2.sol",
    lang: "solidity",
    badge: "Escrow",
    meta: [
      { label: "Action", value: "approve / refund" },
      { label: "Authority", value: "contract-defined" },
      { label: "Destination", value: "provider · client" },
    ],
    code: snip(`
// DealLockMultiAssetV2.sol — funds move ONLY through contract actions.

// Client approves a submitted milestone -> funds release to the PROVIDER.
function approveMilestone(uint256 milestoneId)
    external onlyClient inState(AgreementState.Funded) nonReentrant
{
    Milestone storage m = milestones[milestoneId];
    require(m.state == MilestoneState.Submitted, "Milestone not submitted");

    m.state = MilestoneState.Released;
    _sendPayment(payable(provider), m.amount);     // provider is paid
    emit MilestoneReleased(milestoneId, m.amount);
}

// If a milestone expires unmet, the client can pull the funds back.
function refundExpiredMilestone(uint256 milestoneId)
    external onlyClient inState(AgreementState.Funded) nonReentrant
{
    // ...deadline checks...
    m.state = MilestoneState.Refunded;
    _sendPayment(payable(client), m.amount);       // client is refunded
}
`),
  },
];
