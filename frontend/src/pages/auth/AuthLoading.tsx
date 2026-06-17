/*
 * AuthLoading — the calm metallic skeleton shown inside the auth card while the
 * initial session check (GET /auth/me) settles. Silver sweep, no spinner.
 */
import { SkeletonButton, SkeletonText } from "../../components/app";

export default function AuthLoading() {
  return (
    <div className="dl-auth__steps" aria-busy="true">
      <SkeletonText lines={2} width="100%" lastWidth="70%" />
      <SkeletonButton width="100%" />
    </div>
  );
}
