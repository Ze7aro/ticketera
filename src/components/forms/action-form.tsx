"use client";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  startTransition,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";
const inputClass =
  "w-full min-h-11 rounded-lg border bg-card px-3 py-2 text-base text-foreground disabled:opacity-60";
export function Field({
  label,
  hint,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        className={inputClass}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && (
        <p
          id={`${id}-hint`}
          className="mt-2 text-xs leading-5 text-muted-foreground"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
export function TextArea({
  label,
  ...props
}: ComponentProps<"textarea"> & { label: string }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      <textarea id={id} className={inputClass} rows={3} {...props} />
    </div>
  );
}
export function Checkbox({
  label,
  ...props
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
      <input type="checkbox" className="size-5 accent-primary" {...props} />
      {label}
    </label>
  );
}
export function ActionForm({
  action,
  children,
  submitLabel = "Guardar",
  confirm,
  className = "",
  disabled = false,
  resetOnSuccess = false,
  submitDisabled = false,
}: {
  action: (previous: FormState, form: FormData) => Promise<FormState>;
  children?: ReactNode;
  submitLabel?: string;
  confirm?: string;
  className?: string;
  disabled?: boolean;
  resetOnSuccess?: boolean;
  submitDisabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) {
      if (resetOnSuccess) formRef.current?.reset();
      if (state.redirectTo && state.redirectTo !== pathname)
        router.push(state.redirectTo);
    }
  }, [state, router, pathname, resetOnSuccess]);
  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className={className}
    >
      <fieldset disabled={pending || disabled} className="min-w-0 space-y-5">
        {children}
        <Button type="submit" disabled={pending || disabled || submitDisabled}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </fieldset>
      {state.error && (
        <p
          role="alert"
          aria-label="Error del formulario"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900"
        >
          {state.success}
        </p>
      )}
    </form>
  );
}
