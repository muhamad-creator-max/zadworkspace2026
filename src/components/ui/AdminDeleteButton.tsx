"use client";
import { Trash2 } from "lucide-react";
import { useToast } from "./Toast";

/**
 * A delete button that only works for admins.
 * Non-admins see the same button but clicking shows an access-denied toast.
 * `isAdmin` can be `null` (still loading) — button is disabled in that case.
 */
export function AdminDeleteButton({
  isAdmin,
  onClick,
  className = "",
}: {
  isAdmin: boolean | null;
  onClick: () => void;
  className?: string;
}) {
  const { push } = useToast();

  const handleClick = () => {
    if (isAdmin === null) return;
    if (!isAdmin) {
      push({
        kind: "err",
        msg: "Only an Admin can delete records.",
      });
      return;
    }
    onClick();
  };

  return (
    <button
      className={`btn btn-ghost !px-2 !py-1 ${className}`}
      onClick={handleClick}
      disabled={isAdmin === null}
      aria-label="Delete"
      title={isAdmin ? "Delete" : "Admin only"}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
