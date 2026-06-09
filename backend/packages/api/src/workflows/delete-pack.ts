import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { deletePackStep, type DeletePackInput } from "./steps/delete-pack";

// delete-pack — remove a pack and its prize-pool membership (cards + Pull history
// kept).
export const deletePackWorkflow = createWorkflow(
  "delete-pack",
  function (input: DeletePackInput) {
    const result = deletePackStep(input);
    return new WorkflowResponse(result);
  }
);

export default deletePackWorkflow;
