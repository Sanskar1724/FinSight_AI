import { KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spin } from "@/components/ui/spin";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api";

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700"
    >
      {message}
    </p>
  );
}

export function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (next.length < 8) return setError("Use at least 8 characters for the new password.");
    if (next !== confirm) return setError("The new passwords don't match.");
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed. Other devices have been signed out.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change your password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <CardTitle>Password</CardTitle>
        </div>
        <CardDescription>
          Changing it keeps you signed in here and signs out every other device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </div>
          </div>
          <ErrorNote message={error} />
          <Button type="submit" size="sm" disabled={saving || !current || !next || !confirm}>
            {saving ? <Spin /> : null}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function DeleteAccountCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const close = (value: boolean) => {
    if (deleting) return;
    setOpen(value);
    if (!value) {
      setPassword("");
      setTyped("");
      setError("");
    }
  };

  const confirmDelete = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setDeleting(true);
    try {
      await api.post("/auth/delete-account", { password });
      await logout();
      toast.success("Your account and all of its data have been deleted.");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete your account.");
      setDeleting(false);
    }
  };

  return (
    <Card className="border-rose-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trash2 className="size-4 text-rose-600" />
          <CardTitle>Delete account</CardTitle>
        </div>
        <CardDescription>
          Permanently erase your account and every transaction, budget, goal, bill, notification,
          AI conversation, and research run. This can&apos;t be undone, so download your CSV first
          if you want a copy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="size-3.5" />
          Delete my account
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-md">
          <form onSubmit={confirmDelete} className="space-y-4">
            <DialogHeader>
              <div className="mb-1 grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
                <Trash2 className="size-4" />
              </div>
              <DialogTitle>Delete your account permanently?</DialogTitle>
              <DialogDescription>
                All of your data is erased immediately. Type <strong>DELETE</strong> and enter your
                password to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">Type DELETE</Label>
              <Input
                id="delete-confirm"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-password">Password</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <ErrorNote message={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleting || typed !== "DELETE" || !password}
              >
                {deleting ? <Spin /> : null}
                Delete forever
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
