import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  ensureProfileHandleStep,
  type EnsureProfileHandleInput,
} from "./steps/ensure-profile-handle";

// ensure-profile-handle — idempotently assign (or return) the customer's
// public profile handle. Single compensated step; see the step for the
// derivation + uniqueness rules.
export const ensureProfileHandleWorkflow = createWorkflow(
  "ensure-profile-handle",
  function (input: EnsureProfileHandleInput) {
    const result = ensureProfileHandleStep(input);
    return new WorkflowResponse(result);
  },
);

export default ensureProfileHandleWorkflow;
