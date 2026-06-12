"use client";

import {useRef, useState} from "react";
import {useTranslations} from "next-intl";
import Image from "next/image";
import {
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plane,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Badge} from "@/components/ui/badge";

import {updateProfileAction} from "@/app/[locale]/server-actions";
import {
  addWorkAction,
  updateWorkAction,
  deleteWorkAction,
  addEducationAction,
  updateEducationAction,
  deleteEducationAction,
  addInterestAction,
  removeInterestAction,
  addHobbyAction,
  removeHobbyAction,
  addLinkAction,
  updateLinkAction,
  deleteLinkAction,
  addTravelAction,
  removeTravelAction,
} from "@/lib/actions/profile-details";
import {prepareImageForUpload, ImageUploadError} from "@/lib/images/client-compression";
import {ACCEPTED_IMAGE_EXTENSIONS} from "@/lib/images/upload-config";
import {cn} from "@/lib/utils/cn";
import {useRouter} from "@/lib/i18n/routing";

import type {
  ProfileEducationRow,
  ProfileHobbyRow,
  ProfileInterestRow,
  ProfileLinkRow,
  ProfileRow,
  ProfileTravelRow,
  ProfileWorkRow,
} from "@/types/database";

// ---------- Inline Components ----------

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card shadow-[0_8px_24px_rgba(12,31,44,0.07)]">
      <div className="flex items-center gap-2 border-b border-border/50 px-5 py-3.5">
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="px-5 py-3">{children}</div>
    </div>
  );
}

function FieldRow({
  icon,
  label,
  value,
  onEdit,
  editing,
  editor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onEdit: () => void;
  editing: boolean;
  editor: React.ReactNode;
}) {
  if (editing) {
    return (
      <div className="flex items-start gap-3 py-2.5">
        <span className="mt-2 shrink-0 text-muted-foreground">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
          {editor}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 border-b border-border/30 py-2.5 last:border-0">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-sm", !value && "italic text-muted-foreground/60")}>
          {value || "Not set"}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}

const LINK_PLATFORMS: {value: string; label: string; placeholder: string}[] = [
  {value: "website", label: "Website", placeholder: "https://example.com"},
  {value: "portfolio", label: "Portfolio", placeholder: "https://..."},
  {value: "youtube", label: "YouTube", placeholder: "https://youtube.com/..."},
  {value: "github", label: "GitHub", placeholder: "https://github.com/..."},
  {value: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/..."},
  {value: "instagram", label: "Instagram", placeholder: "https://instagram.com/..."},
  {value: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@"},
];

// ---------- Main Modal ----------

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile: ProfileRow;
  work: ProfileWorkRow[];
  education: ProfileEducationRow[];
  interests: ProfileInterestRow[];
  hobbies: ProfileHobbyRow[];
  links: ProfileLinkRow[];
  travel: ProfileTravelRow[];
  locale: string;
}

export function EditProfileModal({
  open,
  onClose,
  profile,
  work,
  education,
  interests,
  hobbies,
  links,
  travel,
  locale,
}: EditProfileModalProps) {
  const t = useTranslations("Profile");
  const aboutT = useTranslations("ProfileAbout");
  const errorsT = useTranslations("Errors");
  const imageT = useTranslations("ImageUpload");
  const router = useRouter();

  // Image upload
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);
  const [coverPreview, setCoverPreview] = useState<string | null>(profile.cover_image_url);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Basic field editing
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingField, setSavingField] = useState(false);

  // Work / Education add forms
  const [showWorkForm, setShowWorkForm] = useState(false);
  const [showEduForm, setShowEduForm] = useState(false);

  // Travel add
  const [travelInput, setTravelInput] = useState("");

  // Interest / Hobby add
  const [interestInput, setInterestInput] = useState("");
  const [hobbyInput, setHobbyInput] = useState("");

  // Links
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  // Work / Education inline edit
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [deletingWorkId, setDeletingWorkId] = useState<string | null>(null);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [deletingEduId, setDeletingEduId] = useState<string | null>(null);

  function getUploadErrorMessage(error: unknown) {
    if (error instanceof ImageUploadError) return imageT(error.code);
    return imageT("failed");
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const prepared = await prepareImageForUpload(file, "avatar");
      setAvatarFile(prepared);
      setAvatarPreview(URL.createObjectURL(prepared));
    } catch (error) {
      toast.error(getUploadErrorMessage(error));
      e.target.value = "";
    } finally {
      setImageUploading(false);
    }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const prepared = await prepareImageForUpload(file, "cover");
      setCoverFile(prepared);
      setCoverPreview(URL.createObjectURL(prepared));
    } catch (error) {
      toast.error(getUploadErrorMessage(error));
      e.target.value = "";
    } finally {
      setImageUploading(false);
    }
  }

  async function handleSaveImage() {
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.set("locale", locale);
      formData.set("username", profile.username ?? "");
      formData.set("fullName", profile.full_name ?? "");
      formData.set("bio", profile.bio ?? "");
      formData.set("city", profile.city ?? "");
      formData.set("hometown", profile.hometown ?? "");
      formData.set("languagesSpoken", (profile.languages_spoken ?? []).join(", "));
      formData.set("languagePreference", profile.language_preference ?? "auto");
      formData.set("avatarUrl", profile.avatar_url ?? "");
      formData.set("coverImageUrl", profile.cover_image_url ?? "");
      if (avatarFile) formData.set("avatarFile", avatarFile);
      if (coverFile) formData.set("coverFile", coverFile);

      const result = await updateProfileAction(formData);
      if (!result.success) {
        toast.error(result.error ?? errorsT("saveFailed"));
        return;
      }
      toast.success(t("photoUpdated"));
      router.refresh();
    } catch {
      toast.error(errorsT("saveFailed"));
    } finally {
      setImageUploading(false);
    }
  }

  function startEditing(field: string, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue);
  }

  function cancelEditing() {
    setEditingField(null);
    setEditValue("");
  }

  async function handleSaveBasicField(field: string) {
    setSavingField(true);
    try {
      const formData = new FormData();
      formData.set("locale", locale);
      formData.set(
        "username",
        field === "username" ? editValue : profile.username ?? "",
      );
      formData.set(
        "fullName",
        field === "fullName" ? editValue : profile.full_name ?? "",
      );
      formData.set("bio", field === "bio" ? editValue : profile.bio ?? "");
      formData.set("city", field === "city" ? editValue : profile.city ?? "");
      formData.set(
        "hometown",
        field === "hometown" ? editValue : profile.hometown ?? "",
      );
      formData.set(
        "languagesSpoken",
        field === "languages" ? editValue : (profile.languages_spoken ?? []).join(", "),
      );
      formData.set("languagePreference", profile.language_preference ?? "auto");
      formData.set("avatarUrl", profile.avatar_url ?? "");
      formData.set("coverImageUrl", profile.cover_image_url ?? "");

      const result = await updateProfileAction(formData);
      if (!result.success) {
        toast.error(result.error ?? errorsT("saveFailed"));
        return;
      }
      toast.success(t("updated"));
      setEditingField(null);
      router.refresh();
    } catch {
      toast.error(errorsT("saveFailed"));
    } finally {
      setSavingField(false);
    }
  }

  // --- Work handlers ---
  async function handleDeleteWork(id: string) {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", id);
    const res = await deleteWorkAction(fd);
    if (!res.error) {
      setDeletingWorkId(null);
      router.refresh();
    }
  }

  // --- Education handlers ---
  async function handleDeleteEducation(id: string) {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", id);
    const res = await deleteEducationAction(fd);
    if (!res.error) {
      setDeletingEduId(null);
      router.refresh();
    }
  }

  // --- Link handlers ---
  async function handleDeleteLink(id: string) {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", id);
    await deleteLinkAction(fd);
    router.refresh();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pt-8 sm:items-center sm:pt-0">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-auto w-full max-w-2xl rounded-2xl bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{t("editProfile")}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[82vh] space-y-5 overflow-y-auto p-5">
          {/* ============ IMAGE UPLOAD ============ */}
          <div className="rounded-2xl border border-border/80 bg-card shadow-[0_8px_24px_rgba(12,31,44,0.07)]">
            <div className="p-5 pb-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("fields.coverImage")}
                </label>
                <div
                  className="group relative h-32 cursor-pointer overflow-hidden rounded-xl bg-muted"
                  onClick={() => coverInputRef.current?.click()}
                >
                  {coverPreview ? (
                    <Image
                      src={coverPreview}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 640px"
                      unoptimized={
                        coverPreview.startsWith("blob:") || coverPreview.startsWith("data:")
                      }
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20">
                      <Camera size={32} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                    <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium opacity-0 transition group-hover:opacity-100">
                      {t("changeCover")}
                    </span>
                  </div>
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_EXTENSIONS}
                  className="hidden"
                  onChange={handleCoverChange}
                />
              </div>

              <div className="flex justify-center -mt-10">
                <div className="group relative inline-block">
                  <div
                    className="h-20 w-20 cursor-pointer overflow-hidden rounded-full border-4 border-card bg-muted"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {avatarPreview ? (
                      <Image
                        src={avatarPreview}
                        alt=""
                        fill
                        sizes="80px"
                        unoptimized={
                          avatarPreview.startsWith("blob:") || avatarPreview.startsWith("data:")
                        }
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Camera size={24} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div
                    className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/0 transition hover:bg-black/20"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background/80 opacity-0 transition group-hover:opacity-100">
                      <Camera size={12} className="text-foreground" />
                    </div>
                  </div>
                </div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_EXTENSIONS}
                className="hidden"
                onChange={handleAvatarChange}
              />

              {(avatarFile || coverFile) && (
                <div className="mt-3 flex justify-center">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveImage}
                    disabled={imageUploading}
                  >
                    {imageUploading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        {imageT("uploading")}
                      </span>
                    ) : (
                      t("save")
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ============ SECTION 1: BASIC INFO ============ */}
          <SectionCard icon={<UserRound size={16} />} title={aboutT("basicInfo")}>
            <FieldRow
              icon={<UserRound size={16} />}
              label={t("fields.fullName")}
              value={profile.full_name ?? ""}
              onEdit={() => startEditing("fullName", profile.full_name ?? "")}
              editing={editingField === "fullName"}
              editor={
                <div className="space-y-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={t("fields.fullName")}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSaveBasicField("fullName")}
                      disabled={savingField || !editValue.trim()}
                    >
                      {savingField ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        aboutT("save")
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      {aboutT("cancel")}
                    </Button>
                  </div>
                </div>
              }
            />
            <FieldRow
              icon={<AtIcon />}
              label={t("fields.username")}
              value={profile.username ? `@${profile.username}` : ""}
              onEdit={() => startEditing("username", profile.username ?? "")}
              editing={editingField === "username"}
              editor={
                <div className="space-y-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={t("fields.username")}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSaveBasicField("username")}
                      disabled={savingField || !editValue.trim()}
                    >
                      {savingField ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        aboutT("save")
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      {aboutT("cancel")}
                    </Button>
                  </div>
                </div>
              }
            />
            <FieldRow
              icon={<BookOpen size={16} />}
              label={t("fields.bio")}
              value={profile.bio ?? ""}
              onEdit={() => startEditing("bio", profile.bio ?? "")}
              editing={editingField === "bio"}
              editor={
                <div className="space-y-2">
                  <Textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={t("fields.bio")}
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSaveBasicField("bio")}
                      disabled={savingField}
                    >
                      {savingField ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        aboutT("save")
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      {aboutT("cancel")}
                    </Button>
                  </div>
                </div>
              }
            />
          </SectionCard>

          {/* ============ SECTION 2: WORK & EDUCATION ============ */}
          <SectionCard
            icon={<Briefcase size={16} />}
            title={aboutT("workAndEducation")}
          >
            {/* Work */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Building2 size={14} className="text-primary" />
                  {aboutT("addWork")}
                </h4>
                {!showWorkForm && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setShowWorkForm(true)}
                  >
                    <Plus size={12} />
                    {aboutT("addWork")}
                  </Button>
                )}
              </div>

              {showWorkForm && (
                <form
                  action={async (fd) => {
                    const res = await addWorkAction(fd);
                    if (!res.error) setShowWorkForm(false);
                    router.refresh();
                  }}
                  className="mb-3 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="company" placeholder={aboutT("company")} required className="text-sm" />
                    <Input name="position" placeholder={aboutT("position")} required className="text-sm" />
                    <Input name="startYear" type="number" placeholder={aboutT("startYear")} required className="text-sm" />
                    <Input name="endYear" type="number" placeholder={aboutT("endYear")} className="text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" name="isCurrent" value="true" />
                    {aboutT("currentJob")}
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="text-xs">
                      {aboutT("save")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setShowWorkForm(false)}
                    >
                      {aboutT("cancel")}
                    </Button>
                  </div>
                </form>
              )}

              {work.length === 0 && !showWorkForm ? (
                <p className="py-1 text-xs italic text-muted-foreground">{aboutT("noWork")}</p>
              ) : (
                <div className="space-y-2">
                  {work.map((entry) => (
                    <WorkEntry
                      key={entry.id}
                      entry={entry}
                      locale={locale}
                      editing={editingWorkId === entry.id}
                      deleting={deletingWorkId === entry.id}
                      onEdit={() => setEditingWorkId(entry.id)}
                      onCancel={() => setEditingWorkId(null)}
                      onDelete={() => setDeletingWorkId(entry.id)}
                      onDeleteCancel={() => setDeletingWorkId(null)}
                      onDeleteConfirm={() => handleDeleteWork(entry.id)}
                      onSaved={() => {
                        setEditingWorkId(null);
                        router.refresh();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Education */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <GraduationCap size={14} className="text-primary" />
                  {aboutT("addEducation")}
                </h4>
                {!showEduForm && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setShowEduForm(true)}
                  >
                    <Plus size={12} />
                    {aboutT("addEducation")}
                  </Button>
                )}
              </div>

              {showEduForm && (
                <form
                  action={async (fd) => {
                    const res = await addEducationAction(fd);
                    if (!res.error) setShowEduForm(false);
                    router.refresh();
                  }}
                  className="mb-3 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="school" placeholder={aboutT("school")} required className="text-sm" />
                    <Input name="degree" placeholder={aboutT("degree")} className="text-sm" />
                    <Input name="fieldOfStudy" placeholder={aboutT("fieldOfStudy")} className="text-sm" />
                    <Input name="startYear" type="number" placeholder={aboutT("startYear")} required className="text-sm" />
                    <Input name="endYear" type="number" placeholder={aboutT("endYear")} className="text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="text-xs">
                      {aboutT("save")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setShowEduForm(false)}
                    >
                      {aboutT("cancel")}
                    </Button>
                  </div>
                </form>
              )}

              {education.length === 0 && !showEduForm ? (
                <p className="py-1 text-xs italic text-muted-foreground">{aboutT("noEducation")}</p>
              ) : (
                <div className="space-y-2">
                  {education.map((entry) => (
                    <EducationEntry
                      key={entry.id}
                      entry={entry}
                      locale={locale}
                      editing={editingEduId === entry.id}
                      deleting={deletingEduId === entry.id}
                      onEdit={() => setEditingEduId(entry.id)}
                      onCancel={() => setEditingEduId(null)}
                      onDelete={() => setDeletingEduId(entry.id)}
                      onDeleteCancel={() => setDeletingEduId(null)}
                      onDeleteConfirm={() => handleDeleteEducation(entry.id)}
                      onSaved={() => {
                        setEditingEduId(null);
                        router.refresh();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          {/* ============ SECTION 3: PLACES ============ */}
          <SectionCard icon={<MapPin size={16} />} title={aboutT("places")}>
            <FieldRow
              icon={<MapPin size={16} />}
              label={aboutT("currentCity")}
              value={profile.city ?? ""}
              onEdit={() => startEditing("city", profile.city ?? "")}
              editing={editingField === "city"}
              editor={
                <div className="space-y-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={aboutT("currentCity")}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveBasicField("city")} disabled={savingField}>
                      {savingField ? <Loader2 size={14} className="animate-spin" /> : aboutT("save")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      {aboutT("cancel")}
                    </Button>
                  </div>
                </div>
              }
            />
            <FieldRow
              icon={<Home size={16} />}
              label={aboutT("hometown")}
              value={profile.hometown ?? ""}
              onEdit={() => startEditing("hometown", profile.hometown ?? "")}
              editing={editingField === "hometown"}
              editor={
                <div className="space-y-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={aboutT("hometown")}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveBasicField("hometown")} disabled={savingField}>
                      {savingField ? <Loader2 size={14} className="animate-spin" /> : aboutT("save")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      {aboutT("cancel")}
                    </Button>
                  </div>
                </div>
              }
            />
            <FieldRow
              icon={<BookOpen size={16} />}
              label={aboutT("languages")}
              value={(profile.languages_spoken ?? []).join(", ")}
              onEdit={() =>
                startEditing("languages", (profile.languages_spoken ?? []).join(", "))
              }
              editing={editingField === "languages"}
              editor={
                <div className="space-y-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={aboutT("languages")}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveBasicField("languages")} disabled={savingField}>
                      {savingField ? <Loader2 size={14} className="animate-spin" /> : aboutT("save")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      {aboutT("cancel")}
                    </Button>
                  </div>
                </div>
              }
            />

            {/* Travel */}
            <div className="border-t border-border/30 pt-3 mt-1">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Plane size={14} className="text-primary" />
                  {aboutT("travelHistory")}
                </h4>
              </div>

              <form
                action={async (fd) => {
                  await addTravelAction(fd);
                  setTravelInput("");
                  router.refresh();
                }}
                className="mb-3 flex gap-2"
              >
                <input type="hidden" name="locale" value={locale} />
                <Input
                  name="country"
                  value={travelInput}
                  onChange={(e) => setTravelInput(e.target.value)}
                  placeholder={aboutT("countryPlaceholder")}
                  className="flex-1 text-sm"
                />
                <Button type="submit" size="sm" className="text-xs" disabled={!travelInput.trim()}>
                  <Plus size={14} />
                </Button>
              </form>

              {travel.length === 0 ? (
                <p className="py-1 text-xs italic text-muted-foreground">{aboutT("noTravel")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {travel.map((tr) => (
                    <Badge key={tr.id} className="gap-1 pl-3 pr-2 text-xs">
                      <span>{tr.country}</span>
                      <form
                        action={async () => {
                          const fd = new FormData();
                          fd.set("locale", locale);
                          fd.set("country", tr.country);
                          await removeTravelAction(fd);
                          router.refresh();
                        }}
                        className="inline"
                      >
                        <button
                          type="submit"
                          className="ml-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </form>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          {/* ============ SECTION 4: CONTACT INFO ============ */}
          <SectionCard icon={<Phone size={16} />} title={aboutT("contact")}>
            {[/* phone, email, whatsapp */
              ...links.filter((l) => ["phone", "email", "whatsapp"].includes(l.platform)),
            ].length === 0 ? (
              <p className="py-1 text-xs italic text-muted-foreground">{aboutT("noLinks")}</p>
            ) : null}

            {links
              .filter((l) => ["phone", "email", "whatsapp"].includes(l.platform))
              .map((link) => (
                <ContactLinkRow
                  key={link.id}
                  link={link}
                  locale={locale}
                  editing={editingLinkId === link.id}
                  onEdit={() => setEditingLinkId(link.id)}
                  onCancel={() => setEditingLinkId(null)}
                  onDelete={() => handleDeleteLink(link.id)}
                  onSaved={() => {
                    setEditingLinkId(null);
                    router.refresh();
                  }}
                />
              ))}

            <div className="mt-2 flex flex-wrap gap-2">
              {!links.some((l) => l.platform === "phone") && (
                <AddContactLinkForm
                  platform="phone"
                  label={aboutT("phone")}
                  type="tel"
                  placeholder="+222 ..."
                  locale={locale}
                  onSaved={() => router.refresh()}
                />
              )}
              {!links.some((l) => l.platform === "email") && (
                <AddContactLinkForm
                  platform="email"
                  label={aboutT("email")}
                  type="email"
                  placeholder="name@example.com"
                  locale={locale}
                  onSaved={() => router.refresh()}
                />
              )}
            </div>
          </SectionCard>

          {/* ============ SECTION 5: INTERESTS & HOBBIES ============ */}
          <SectionCard icon={<Heart size={16} />} title={aboutT("interests")}>
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-medium text-foreground">{aboutT("interests_title")}</h4>
              <form
                action={async (fd) => {
                  await addInterestAction(fd);
                  setInterestInput("");
                  router.refresh();
                }}
                className="mb-2 flex gap-2"
              >
                <input type="hidden" name="locale" value={locale} />
                <Input
                  name="name"
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  placeholder={aboutT("interestPlaceholder")}
                  className="flex-1 text-sm"
                />
                <Button type="submit" size="sm" className="text-xs" disabled={!interestInput.trim()}>
                  <Plus size={14} />
                </Button>
              </form>
              {interests.length === 0 ? (
                <p className="py-1 text-xs italic text-muted-foreground">{aboutT("noInterests")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {interests.map((interest) => (
                    <Badge key={interest.id} className="gap-1 pl-3 pr-2 text-xs">
                      <span>{interest.name}</span>
                      <form
                        action={async () => {
                          const fd = new FormData();
                          fd.set("locale", locale);
                          fd.set("name", interest.name);
                          await removeInterestAction(fd);
                          router.refresh();
                        }}
                        className="inline"
                      >
                        <button
                          type="submit"
                          className="ml-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </form>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">{aboutT("hobbies_title")}</h4>
              <form
                action={async (fd) => {
                  await addHobbyAction(fd);
                  setHobbyInput("");
                  router.refresh();
                }}
                className="mb-2 flex gap-2"
              >
                <input type="hidden" name="locale" value={locale} />
                <Input
                  name="name"
                  value={hobbyInput}
                  onChange={(e) => setHobbyInput(e.target.value)}
                  placeholder={aboutT("hobbyPlaceholder")}
                  className="flex-1 text-sm"
                />
                <Button type="submit" size="sm" className="text-xs" disabled={!hobbyInput.trim()}>
                  <Plus size={14} />
                </Button>
              </form>
              {hobbies.length === 0 ? (
                <p className="py-1 text-xs italic text-muted-foreground">{aboutT("noHobbies")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {hobbies.map((hobby) => (
                    <Badge key={hobby.id} className="gap-1 pl-3 pr-2 text-xs">
                      <span>{hobby.name}</span>
                      <form
                        action={async () => {
                          const fd = new FormData();
                          fd.set("locale", locale);
                          fd.set("name", hobby.name);
                          await removeHobbyAction(fd);
                          router.refresh();
                        }}
                        className="inline"
                      >
                        <button
                          type="submit"
                          className="ml-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </form>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          {/* ============ SECTION 6: LINKS ============ */}
          <SectionCard icon={<Link2 size={16} />} title={aboutT("links")}>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">{aboutT("addLink")}</h4>
              {!showLinkForm && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setShowLinkForm(true)}
                >
                  <Plus size={12} />
                  {aboutT("addLink")}
                </Button>
              )}
            </div>

            {showLinkForm && (
              <form
                action={async (fd) => {
                  const res = await addLinkAction(fd);
                  if (!res.error) {
                    setShowLinkForm(false);
                    const form = document.getElementById("link-add-form") as HTMLFormElement;
                    form?.reset();
                  }
                  router.refresh();
                }}
                id="link-add-form"
                className="mb-3 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3"
              >
                <input type="hidden" name="locale" value={locale} />
                <select
                  name="platform"
                  className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm outline-none ring-primary/30 focus:ring"
                  required
                >
                  <option value="">{aboutT("addLink")}...</option>
                  {LINK_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <Input name="value" placeholder={aboutT("linkPlaceholder")} required className="text-sm" />
                <select
                  name="visibility"
                  className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm outline-none ring-primary/30 focus:ring"
                >
                  <option value="public">{aboutT("public")}</option>
                  <option value="followers">{aboutT("followers")}</option>
                  <option value="only_me">{aboutT("onlyMe")}</option>
                </select>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="text-xs">
                    {aboutT("save")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowLinkForm(false)}
                  >
                    {aboutT("cancel")}
                  </Button>
                </div>
              </form>
            )}

            {links.filter((l) => !["phone", "email", "whatsapp"].includes(l.platform)).length === 0 &&
            !showLinkForm ? (
              <p className="py-1 text-xs italic text-muted-foreground">{aboutT("noLinks")}</p>
            ) : (
              <div className="space-y-2">
                {links
                  .filter((l) => !["phone", "email", "whatsapp"].includes(l.platform))
                  .map((link) => {
                    const platform = LINK_PLATFORMS.find((p) => p.value === link.platform);
                    if (editingLinkId === link.id) {
                      return (
                        <form
                          key={link.id}
                          action={async (fd) => {
                            const res = await updateLinkAction(fd);
                            if (!res.error) setEditingLinkId(null);
                            router.refresh();
                          }}
                          className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3"
                        >
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={link.id} />
                          <Input
                            name="value"
                            defaultValue={link.value}
                            placeholder={aboutT("linkPlaceholder")}
                            required
                            className="text-sm"
                          />
                          <select
                            name="visibility"
                            defaultValue={link.visibility}
                            className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm outline-none ring-primary/30 focus:ring"
                          >
                            <option value="public">{aboutT("public")}</option>
                            <option value="followers">{aboutT("followers")}</option>
                            <option value="only_me">{aboutT("onlyMe")}</option>
                          </select>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" className="text-xs">
                              {aboutT("save")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => setEditingLinkId(null)}
                            >
                              {aboutT("cancel")}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="ml-auto text-xs"
                              onClick={() => handleDeleteLink(link.id)}
                            >
                              {aboutT("delete")}
                            </Button>
                          </div>
                        </form>
                      );
                    }
                    return (
                      <div
                        key={link.id}
                        className="group flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 transition hover:border-primary/30"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Globe size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {link.label || platform?.label || link.platform}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{link.value}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingLinkId(link.id)}
                          className="ml-2 shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ---------- Sub-components ----------

function AtIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  );
}

function formatYearRange(startYear: number, endYear: number | null, isCurrent: boolean) {
  if (isCurrent) return `${startYear} - Present`;
  if (endYear) return `${startYear} - ${endYear}`;
  return `${startYear}`;
}

function WorkEntry({
  entry,
  locale,
  editing,
  deleting,
  onEdit,
  onCancel,
  onDelete,
  onDeleteCancel,
  onDeleteConfirm,
  onSaved,
}: {
  entry: ProfileWorkRow;
  locale: string;
  editing: boolean;
  deleting: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
  onSaved: () => void;
}) {
  const aboutT = useTranslations("ProfileAbout");
  if (deleting) {
    return (
      <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-sm">{aboutT("workConfirmDelete")}</p>
        <div className="flex gap-2">
          <Button type="button" variant="destructive" size="sm" className="text-xs" onClick={onDeleteConfirm}>
            {aboutT("delete")}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={onDeleteCancel}>
            {aboutT("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <form
        action={async (fd) => {
          const res = await updateWorkAction(fd);
          if (!res.error) onSaved();
        }}
        className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={entry.id} />
        <div className="grid grid-cols-2 gap-2">
          <Input name="company" defaultValue={entry.company} placeholder="Company" required className="text-sm" />
          <Input name="position" defaultValue={entry.position} placeholder="Position" required className="text-sm" />
          <Input name="startYear" defaultValue={entry.start_year} type="number" placeholder="Start Year" required className="text-sm" />
          <Input name="endYear" defaultValue={entry.end_year ?? ""} type="number" placeholder="End Year" className="text-sm" />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="isCurrent" defaultChecked={entry.is_current} value="true" />
          I currently work here
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="text-xs">
            {aboutT("save")}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={onCancel}>
            {aboutT("cancel")}
          </Button>
          <Button type="button" variant="destructive" size="sm" className="ml-auto text-xs" onClick={onDelete}>
            {aboutT("delete")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3 transition hover:border-primary/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Building2 size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{entry.position}</p>
        <p className="text-sm text-muted-foreground">{entry.company}</p>
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          {formatYearRange(entry.start_year, entry.end_year, entry.is_current)}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}

function EducationEntry({
  entry,
  locale,
  editing,
  deleting,
  onEdit,
  onCancel,
  onDelete,
  onDeleteCancel,
  onDeleteConfirm,
  onSaved,
}: {
  entry: ProfileEducationRow;
  locale: string;
  editing: boolean;
  deleting: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
  onSaved: () => void;
}) {
  const aboutT = useTranslations("ProfileAbout");
  if (deleting) {
    return (
      <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-sm">{aboutT("educationConfirmDelete")}</p>
        <div className="flex gap-2">
          <Button type="button" variant="destructive" size="sm" className="text-xs" onClick={onDeleteConfirm}>
            {aboutT("delete")}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={onDeleteCancel}>
            {aboutT("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <form
        action={async (fd) => {
          const res = await updateEducationAction(fd);
          if (!res.error) onSaved();
        }}
        className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={entry.id} />
        <div className="grid grid-cols-2 gap-2">
          <Input name="school" defaultValue={entry.school} placeholder="School" required className="text-sm" />
          <Input name="degree" defaultValue={entry.degree ?? ""} placeholder="Degree" className="text-sm" />
          <Input name="fieldOfStudy" defaultValue={entry.field_of_study ?? ""} placeholder="Field of Study" className="text-sm" />
          <Input name="startYear" defaultValue={entry.start_year} type="number" placeholder="Start Year" required className="text-sm" />
          <Input name="endYear" defaultValue={entry.end_year ?? ""} type="number" placeholder="End Year" className="text-sm" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="text-xs">
            {aboutT("save")}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={onCancel}>
            {aboutT("cancel")}
          </Button>
          <Button type="button" variant="destructive" size="sm" className="ml-auto text-xs" onClick={onDelete}>
            {aboutT("delete")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3 transition hover:border-primary/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <GraduationCap size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{entry.degree || "Student"}</p>
        <p className="text-sm text-muted-foreground">{entry.school}</p>
        {entry.field_of_study && (
          <p className="text-xs text-muted-foreground/70">{entry.field_of_study}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          {formatYearRange(entry.start_year, entry.end_year, false)}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}

function ContactLinkRow({
  link,
  locale,
  editing,
  onEdit,
  onCancel,
  onDelete,
  onSaved,
}: {
  link: ProfileLinkRow;
  locale: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const aboutT = useTranslations("ProfileAbout");
  if (editing) {
    return (
      <form
        action={async (fd) => {
          const res = await updateLinkAction(fd);
          if (!res.error) onSaved();
        }}
        className="mb-2 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={link.id} />
        <Input
          name="value"
          defaultValue={link.value}
          placeholder={link.platform === "email" ? "name@example.com" : "+222 ..."}
          required
          className="text-sm"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="text-xs">
            {aboutT("save")}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={onCancel}>
            {aboutT("cancel")}
          </Button>
          <Button type="button" variant="destructive" size="sm" className="ml-auto text-xs" onClick={onDelete}>
            {aboutT("delete")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="group flex items-center gap-3 rounded-xl bg-muted/30 p-3 mb-2">
      {link.platform === "email" ? (
        <Mail size={16} className="shrink-0 text-primary" />
      ) : (
        <Phone size={16} className="shrink-0 text-primary" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {link.platform === "email" ? aboutT("email") : aboutT("phone")}
        </p>
        <p className="text-sm font-medium">{link.value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}

function AddContactLinkForm({
  platform,
  label,
  type = "text",
  placeholder,
  locale,
  onSaved,
}: {
  platform: string;
  label: string;
  type?: string;
  placeholder: string;
  locale: string;
  onSaved: () => void;
}) {
  const aboutT = useTranslations("ProfileAbout");
  return (
    <form
      action={async (fd) => {
        await addLinkAction(fd);
        onSaved();
      }}
      className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-2"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="platform" value={platform} />
      <input type="hidden" name="visibility" value="public" />
      <Input name="value" type={type} placeholder={placeholder} required className="h-8 text-xs" aria-label={label} />
      <Button type="submit" size="sm" className="h-8 text-xs">
        {aboutT("addLink")}
      </Button>
    </form>
  );
}
