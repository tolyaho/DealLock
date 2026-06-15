import { Router } from "express";
import { listPaymentAssets, getPaymentAssetByKey } from "../paymentAssets.js";
import { asyncRoute } from "../utils.js";

const router = Router();

function parseChainId(raw: unknown): number | null {
  const value = typeof raw === "string" ? Number(raw) : raw;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const chainId = req.query.chainId === undefined ? undefined : parseChainId(req.query.chainId);
    if (chainId === null) {
      res.status(400).json({ error: "chainId must be a positive integer" });
      return;
    }
    res.json({ assets: listPaymentAssets(chainId) });
  }),
);

router.get(
  "/:chainId/:assetKey",
  asyncRoute(async (req, res) => {
    const chainId = parseChainId(req.params.chainId);
    if (chainId === null) {
      res.status(400).json({ error: "chainId must be a positive integer" });
      return;
    }
    const asset = getPaymentAssetByKey(chainId, req.params.assetKey);
    if (!asset) {
      res.status(404).json({ error: "Payment asset not found" });
      return;
    }
    res.json({ asset });
  }),
);

export default router;
