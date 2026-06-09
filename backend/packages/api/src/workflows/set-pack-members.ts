import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  setPackMembersStep,
  type SetPackMembersInput,
} from "./steps/set-pack-members";

// set-pack-members — reconcile a pack's prize pool to a desired card set
// (add/remove PackOdds; shared rows keep their tuned weights).
export const setPackMembersWorkflow = createWorkflow(
  "set-pack-members",
  function (input: SetPackMembersInput) {
    const result = setPackMembersStep(input);
    return new WorkflowResponse(result);
  }
);

export default setPackMembersWorkflow;
