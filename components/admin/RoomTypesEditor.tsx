"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ImagePlus, RotateCcw, Star, Trash2 } from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCategories } from "@/components/rooms/CategoriesProvider";
import { RoomImage } from "@/components/rooms/RoomImage";
import { Spinner } from "@/components/ui/bits";
import { useToast } from "@/components/ui/Toaster";
import { DEFAULT_PHOTO_IDS, isBuiltIn, MAX_PHOTOS, type LiveCategory } from "@/lib/categories";
import { CATEGORY_LIST, roomCountFor } from "@/lib/constants";
import { addCategoryPhotos, restoreBuiltInPhotos, setCategoryPhotos, updateCategoryPrice } from "@/lib/firebase-actions";
import type { Actor } from "@/lib/types";
import { cx, formatDateTime, naira } from "@/lib/utils";

/** Admin managers set each room type's nightly price and photos */
export function RoomTypesEditor() {
  const { user } = useAuth();
  const { categories, ready } = useCategories();
  if (!user) return null;
  const actor = { uid: user.uid, name: user.name };
  return (
    <div className="grid gap-5">
      {CATEGORY_LIST.map(c => (
        <RoomTypeCard key={c.key} category={categories[c.key]} actor={actor} ready={ready} />
      ))}
    </div>
  );
}

function RoomTypeCard({ category: c, actor, ready }: { category: LiveCategory; actor: Actor; ready: boolean }) {
  return (
    <section className="card grid gap-5 p-4 md:p-6" aria-labelledby={`type-${c.key}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="num text-[11px] tracking-[.1em] text-brass uppercase">
            Rooms {c.range[0]}–{c.range[1]} · {roomCountFor(c)} {c.key === "presidential" ? "suites" : "rooms"} · sleeps {c.maxGuests}
          </div>
          <h3 id={`type-${c.key}`} className="display mt-1 text-[28px]">
            {c.name}
          </h3>
        </div>
        {c.updatedAt && (
          <p className="text-xs text-muted">
            Last changed by {c.updatedBy} · {formatDateTime(c.updatedAt)}
          </p>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <PriceForm category={c} actor={actor} ready={ready} />
        <PhotoManager category={c} actor={actor} />
      </div>
    </section>
  );
}

function PriceForm({ category: c, actor, ready }: { category: LiveCategory; actor: Actor; ready: boolean }) {
  const toast = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = draft ?? String(c.price);
  const price = Number(value.replace(/[^\d]/g, ""));
  const changed = ready && price !== c.price;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateCategoryPrice(c.key, price, actor);
      toast(`${c.name} is now ${naira(price)} per night`);
      setDraft(null);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="grid content-start gap-3">
      <label className="field">
        Price per night
        <span className="relative">
          <span className="num pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">₦</span>
          <input
            className="input num pl-7 text-lg"
            inputMode="numeric"
            value={ready ? Number(price || 0).toLocaleString("en-NG") : ""}
            placeholder={ready ? "" : "Loading…"}
            onChange={e => setDraft(e.target.value)}
            disabled={!ready || busy}
            aria-describedby={`price-note-${c.key}`}
          />
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm" disabled={!changed || busy || price < 1000}>
          {busy && <Spinner className="h-3 w-3" />} Save price
        </button>
        {changed && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)} disabled={busy}>
            Undo
          </button>
        )}
      </div>
      <p id={`price-note-${c.key}`} className="text-xs text-muted">
        {changed ? `${naira(c.price)} → ${naira(price)}. ` : ""}New bookings use the new price. Existing bookings keep the price they were booked at.
      </p>
    </form>
  );
}

function PhotoManager({ category: c, actor }: { category: LiveCategory; actor: Actor }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const ids = c.photoIds;
  const space = MAX_PHOTOS - ids.length;
  const customised = ids.join() !== DEFAULT_PHOTO_IDS.join();

  const upload = async (files: File[]) => {
    const picked = files.filter(f => f.type.startsWith("image/"));
    if (!picked.length) return toast("Choose image files (JPEG, PNG or WebP).", "error");
    if (picked.length > space) return toast(space ? `You can add ${space} more photo${space > 1 ? "s" : ""} to ${c.name} (10 at most).` : `${c.name} already has 10 photos. Remove one first.`, "error");
    setProgress({ done: 0, total: picked.length });
    try {
      await addCategoryPhotos(c.key, picked, actor, (done, total) => setProgress({ done, total }));
      toast(`${picked.length} photo${picked.length > 1 ? "s" : ""} added to ${c.name}`);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  const save = async (next: string[], message: string, done: string) => {
    setBusy(true);
    try {
      await setCategoryPhotos(c.key, next, actor, message);
      toast(done);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const move = (from: number, to: number) => {
    const next = [...ids];
    const [p] = next.splice(from, 1);
    next.splice(to, 0, p!);
    save(next, `${actor.name} reordered the ${c.name} photos`, to === 0 ? "Cover photo updated" : "Photo moved");
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!progress) upload([...e.dataTransfer.files]);
  };

  const restore = async () => {
    setBusy(true);
    try {
      await restoreBuiltInPhotos(c.key, actor);
      toast("Built-in photos restored");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="field">
          Photos · {ids.length} of {MAX_PHOTOS}
        </span>
        {customised && (
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={restore}>
            <RotateCcw className="h-3.5 w-3.5" /> Restore built-in photos
          </button>
        )}
      </div>

      <motion.ul layout className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        <AnimatePresence initial={false}>
          {c.photos.map((p, i) => {
            const id = ids[i]!;
            return (
              <motion.li key={id.slice(-60)} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line">
                <RoomImage src={p} alt={`${c.name} photo ${i + 1}`} fill sizes="(min-width: 1280px) 12vw, (min-width: 640px) 25vw, 45vw" className="object-cover" />
                <span className={cx("absolute top-2 left-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold", i === 0 ? "bg-brass text-[#1a1209]" : "bg-white/90 text-ink")}>
                  {i === 0 ? (
                    <>
                      <Star className="h-3 w-3" /> Cover
                    </>
                  ) : (
                    i + 1
                  )}
                </span>
                {isBuiltIn(id) && <span className="absolute top-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white">Built-in</span>}
                {confirming === id ? (
                  <div className="absolute inset-0 grid place-items-center bg-black/60 p-2 text-center text-xs text-white">
                    <div className="grid gap-2">
                      Remove this photo?
                      <div className="flex justify-center gap-1.5">
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => save(ids.filter(x => x !== id), `${actor.name} removed a ${c.name} photo`, "Photo removed")}>
                          {busy && <Spinner className="h-3 w-3" />} Remove
                        </button>
                        <button className="btn btn-sm border border-white/40 bg-transparent" onClick={() => setConfirming(null)}>
                          Keep
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-6 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                    <div className="flex gap-1">
                      <PhotoButton label="Move left" disabled={busy || i === 0} onClick={() => move(i, i - 1)}>
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </PhotoButton>
                      <PhotoButton label="Move right" disabled={busy || i === ids.length - 1} onClick={() => move(i, i + 1)}>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </PhotoButton>
                      {i > 0 && (
                        <PhotoButton label="Make cover photo" disabled={busy} onClick={() => move(i, 0)}>
                          <Star className="h-3.5 w-3.5" />
                        </PhotoButton>
                      )}
                    </div>
                    <PhotoButton label={ids.length === 1 ? "A room type needs at least one photo" : "Remove photo"} disabled={busy || ids.length === 1} onClick={() => setConfirming(id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </PhotoButton>
                  </div>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>

      <div
        onDragOver={e => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx("grid justify-items-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors", dragging ? "border-brass bg-brass-soft" : "border-line", space <= 0 && "opacity-60")}
      >
        {progress ? (
          <>
            <Spinner className="h-5 w-5 text-pine" />
            <p className="text-sm">
              Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…
            </p>
            <span className="h-1.5 w-48 overflow-hidden rounded-full bg-sunk">
              <motion.span className="block h-full bg-pine" animate={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </span>
          </>
        ) : space > 0 ? (
          <>
            <ImagePlus className="h-6 w-6 text-brass" />
            <p className="text-sm">
              Drag photos here or{" "}
              <button type="button" className="link" onClick={() => input.current?.click()}>
                choose files
              </button>{" "}
              · up to {space} more
            </p>
            <p className="max-w-md text-xs text-muted">
              The first photo is the cover on room cards and the booking banner. All photos show on each room&rsquo;s page. Photos are resized to 1600 px before upload.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">{c.name} has the maximum of {MAX_PHOTOS} photos. Remove one to add another.</p>
        )}
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => upload([...(e.target.files ?? [])])} />
      </div>
    </div>
  );
}

function PhotoButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-ink transition hover:bg-white disabled:opacity-40">
      {children}
    </button>
  );
}
