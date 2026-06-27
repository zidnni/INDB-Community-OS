"use client";

import {useState} from "react";
import {useTranslations, useLocale} from "next-intl";
import {
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  ExternalLink,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plane,
  Plus,
  UserRound,
} from "lucide-react";

import {addEducationAction, addHobbyAction, addInterestAction, addLinkAction, addTravelAction, addWorkAction, deleteEducationAction, deleteLinkAction, deleteWorkAction, removeHobbyAction, removeInterestAction, removeTravelAction, updateEducationAction, updateLinkAction, updateWorkAction} from "@/lib/actions/profile-details";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import type {ProfileEducationRow, ProfileHobbyRow, ProfileInterestRow, ProfileLinkRow, ProfileTravelRow, ProfileWorkRow} from "@/types/database";

interface ProfileAboutData {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  hometown: string | null;
  languages_spoken: string[];
  contribution_score: number;
  created_at: string;
}

interface ProfileAboutProps {
  profile: ProfileAboutData;
  work: ProfileWorkRow[];
  education: ProfileEducationRow[];
  interests: ProfileInterestRow[];
  hobbies: ProfileHobbyRow[];
  links: ProfileLinkRow[];
  travel: ProfileTravelRow[];
  isOwnProfile: boolean;
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

function formatYearRange(startYear: number, endYear: number | null, isCurrent: boolean) {
  if (isCurrent) return `${startYear} - Present`;
  if (endYear) return `${startYear} - ${endYear}`;
  return `${startYear}`;
}

function WorkCard({entry, isOwn, locale}: {entry: ProfileWorkRow; isOwn: boolean; locale: string}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", entry.id);
    const res = await deleteWorkAction(fd);
    if (!res.error) setDeleting(false);
  }

  if (editing) {
    return (
      <form
        action={async (fd) => {
          const res = await updateWorkAction(fd);
          if (!res.error) setEditing(false);
        }}
        className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2"
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
          <Button type="submit" size="sm" className="text-xs">Save</Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setEditing(false)}>Cancel</Button>
          <Button type="button" variant="destructive" size="sm" className="text-xs ml-auto" onClick={() => setDeleting(true)}>Delete</Button>
        </div>
      </form>
    );
  }

  if (deleting) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
        <p className="text-sm">Delete this work entry?</p>
        <div className="flex gap-2">
          <Button type="button" variant="destructive" size="sm" className="text-xs" onClick={handleDelete}>Delete</Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setDeleting(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-xl border border-border/60 bg-card p-3 transition hover:border-primary/30 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Building2 size={16} />
          </div>
          <div>
            <p className="font-medium text-sm">{entry.position}</p>
            <p className="text-sm text-muted-foreground">{entry.company}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {formatYearRange(entry.start_year, entry.end_year, entry.is_current)}
            </p>
          </div>
        </div>
        {isOwn && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button type="button" onClick={() => setEditing(true)} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EducationCard({entry, isOwn, locale}: {entry: ProfileEducationRow; isOwn: boolean; locale: string}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", entry.id);
    const res = await deleteEducationAction(fd);
    if (!res.error) setDeleting(false);
  }

  if (editing) {
    return (
      <form
        action={async (fd) => {
          const res = await updateEducationAction(fd);
          if (!res.error) setEditing(false);
        }}
        className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2"
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
          <Button type="submit" size="sm" className="text-xs">Save</Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setEditing(false)}>Cancel</Button>
          <Button type="button" variant="destructive" size="sm" className="text-xs ml-auto" onClick={() => setDeleting(true)}>Delete</Button>
        </div>
      </form>
    );
  }

  if (deleting) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
        <p className="text-sm">Delete this education entry?</p>
        <div className="flex gap-2">
          <Button type="button" variant="destructive" size="sm" className="text-xs" onClick={handleDelete}>Delete</Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setDeleting(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-xl border border-border/60 bg-card p-3 transition hover:border-primary/30 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <GraduationCap size={16} />
          </div>
          <div>
            <p className="font-medium text-sm">{entry.degree || "Student"}</p>
            <p className="text-sm text-muted-foreground">{entry.school}</p>
            {entry.field_of_study && (
              <p className="text-xs text-muted-foreground/70">{entry.field_of_study}</p>
            )}
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {formatYearRange(entry.start_year, entry.end_year, false)}
            </p>
          </div>
        </div>
        {isOwn && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button type="button" onClick={() => setEditing(true)} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({profile}: {profile: ProfileAboutData; isOwn?: boolean}) {
  const t = useTranslations("ProfileAbout");
  const locale = useLocale();

  const joinDate = new Date(profile.created_at).toLocaleDateString(
    locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US",
    {year: "numeric", month: "long"}
  );

  return (
    <Card>
      <CardContent className="p-5 sm:p-6 space-y-4">
        {profile.bio && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("overview")}</p>
            <p className="text-sm text-foreground/85">{profile.bio}</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {profile.city && (
            <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
              <MapPin size={18} className="text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{t("currentCity")}</p>
                <p className="text-sm font-medium">{profile.city}</p>
              </div>
            </div>
          )}

          {profile.hometown && (
            <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
              <Home size={18} className="text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{t("hometown")}</p>
                <p className="text-sm font-medium">{profile.hometown}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5">
            <CalendarDays size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t("memberSince")} {joinDate}</span>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

function WorkEducationTab({
  work,
  education,
  isOwn,
  localeStr,
}: {
  work: ProfileWorkRow[];
  education: ProfileEducationRow[];
  isOwn: boolean;
  localeStr: string;
}) {
  const t = useTranslations("ProfileAbout");
  const [showWorkForm, setShowWorkForm] = useState(false);
  const [showEduForm, setShowEduForm] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase size={16} className="text-primary" />
            Work
          </CardTitle>
          {isOwn && (
            <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowWorkForm(!showWorkForm)}>
              <Plus size={14} /> {t("addWork")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-2">
          {showWorkForm && isOwn && (
            <form
              action={async (fd) => {
                const res = await addWorkAction(fd);
                if (!res.error) setShowWorkForm(false);
              }}
              className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2 mb-3"
            >
              <input type="hidden" name="locale" value={localeStr} />
              <div className="grid grid-cols-2 gap-2">
                <Input name="company" placeholder="Company" required className="text-sm" />
                <Input name="position" placeholder="Position" required className="text-sm" />
                <Input name="startYear" type="number" placeholder="Start Year" required className="text-sm" />
                <Input name="endYear" type="number" placeholder="End Year" className="text-sm" />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="isCurrent" value="true" />
                {t("currentJob")}
              </label>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="text-xs">{t("save")}</Button>
                <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setShowWorkForm(false)}>{t("cancel")}</Button>
              </div>
            </form>
          )}

          {work.length === 0 && !showWorkForm ? (
            <p className="text-sm text-muted-foreground italic py-2">{t("noWork")}</p>
          ) : (
            work.map((w) => <WorkCard key={w.id} entry={w} isOwn={isOwn} locale={localeStr} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap size={16} className="text-primary" />
            Education
          </CardTitle>
          {isOwn && (
            <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowEduForm(!showEduForm)}>
              <Plus size={14} /> {t("addEducation")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-2">
          {showEduForm && isOwn && (
            <form
              action={async (fd) => {
                const res = await addEducationAction(fd);
                if (!res.error) setShowEduForm(false);
              }}
              className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2 mb-3"
            >
              <input type="hidden" name="locale" value={localeStr} />
              <div className="grid grid-cols-2 gap-2">
                <Input name="school" placeholder="School / University" required className="text-sm" />
                <Input name="degree" placeholder="Degree" className="text-sm" />
                <Input name="fieldOfStudy" placeholder="Field of Study" className="text-sm" />
                <Input name="startYear" type="number" placeholder="Start Year" required className="text-sm" />
                <Input name="endYear" type="number" placeholder="End Year" className="text-sm" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="text-xs">{t("save")}</Button>
                <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setShowEduForm(false)}>{t("cancel")}</Button>
              </div>
            </form>
          )}

          {education.length === 0 && !showEduForm ? (
            <p className="text-sm text-muted-foreground italic py-2">{t("noEducation")}</p>
          ) : (
            education.map((e) => <EducationCard key={e.id} entry={e} isOwn={isOwn} locale={localeStr} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ContactTab({
  links,
  isOwn,
  localeStr,
}: {
  links: ProfileLinkRow[];
  isOwn: boolean;
  localeStr: string;
}) {
  const t = useTranslations("ProfileAbout");

  const contactLinks = links.filter((l) =>
    ["phone", "email", "whatsapp"].includes(l.platform)
  );
  const contactPlatforms = [
    {platform: "phone", label: t("phone"), type: "tel", placeholder: "+222 ..."},
    {platform: "email", label: t("email"), type: "email", placeholder: "name@example.com"},
  ];
  const existingPlatforms = new Set(links.map((link) => link.platform));
  const hasNumber = links.some((link) => link.platform === "phone" || link.platform === "whatsapp");
  const hasEmail = existingPlatforms.has("email");

  function AddLinkForm({
    platform,
    label,
    type = "text",
    placeholder,
  }: {
    platform: string;
    label: string;
    type?: string;
    placeholder: string;
  }) {
    return (
      <form
        action={async (formData) => {
          await addLinkAction(formData);
        }}
        className="grid gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 sm:grid-cols-[1fr_auto]"
      >
        <input type="hidden" name="locale" value={localeStr} />
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="visibility" value="public" />
        <Input name="value" type={type} placeholder={placeholder} required className="text-sm" aria-label={label} />
        <Button type="submit" size="sm" className="text-xs">
          {t("addLink")}
        </Button>
      </form>
    );
  }

  if (contactLinks.length === 0 && !isOwn) {
    return (
      <Card>
        <CardContent className="p-5 sm:p-6">
          <p className="text-sm text-muted-foreground italic">{t("noLinks")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone size={16} className="text-primary" />
            {t("contact")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          {contactLinks.length > 0 ? (
            contactLinks.map((link) => (
              <div key={link.id} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                {link.platform === "phone" && <Phone size={16} className="text-primary shrink-0" />}
                {link.platform === "whatsapp" && <Phone size={16} className="text-primary shrink-0" />}
                {link.platform === "email" && <Mail size={16} className="text-primary shrink-0" />}
                <div>
                  <p className="text-xs text-muted-foreground">{link.platform === "email" ? t("email") : t("phone")}</p>
                  <p className="text-sm font-medium">{link.value}</p>
                </div>
              </div>
            ))
          ) : !isOwn ? (
            <p className="text-sm text-muted-foreground italic">{t("noLinks")}</p>
          ) : null}
          {isOwn ? (
            <div className="space-y-2">
              {contactPlatforms
                .filter((item) => item.platform === "phone" ? !hasNumber : !hasEmail)
                .map((item) => (
                  <AddLinkForm key={item.platform} {...item} />
                ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function PlacesTab({
  profile,
  travel,
  isOwn,
  localeStr,
}: {
  profile: ProfileAboutData;
  travel: ProfileTravelRow[];
  isOwn: boolean;
  localeStr: string;
}) {
  const t = useTranslations("ProfileAbout");
  const [showTravelForm, setShowTravelForm] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 sm:p-6 space-y-3">
          {profile.city && (
            <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
              <MapPin size={18} className="text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{t("currentCity")}</p>
                <p className="text-sm font-medium">{profile.city}</p>
              </div>
            </div>
          )}
          {profile.hometown && (
            <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
              <Home size={18} className="text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{t("hometown")}</p>
                <p className="text-sm font-medium">{profile.hometown}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {profile.languages_spoken && profile.languages_spoken.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen size={16} className="text-primary" />
              {t("languages")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="flex flex-wrap gap-1.5">
              {profile.languages_spoken.map((lang: string) => (
                <Badge key={lang} className="rounded-full bg-muted text-xs">
                  {lang}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Plane size={16} className="text-primary" />
            {t("travelHistory")}
          </CardTitle>
          {isOwn && (
            <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowTravelForm(!showTravelForm)}>
              <Plus size={14} /> {t("addTravel")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {showTravelForm && isOwn && (
            <form
              action={async (fd) => {
                const res = await addTravelAction(fd);
                if (!res.error) setShowTravelForm(false);
              }}
              className="flex gap-2 mb-3"
            >
              <input type="hidden" name="locale" value={localeStr} />
              <Input name="country" placeholder={t("countryPlaceholder")} required className="text-sm flex-1" />
              <Button type="submit" size="sm" className="text-xs">{t("addTravel")}</Button>
            </form>
          )}

          {travel.length === 0 && !showTravelForm ? (
            <p className="text-sm text-muted-foreground italic py-2">{t("noTravel")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {travel.map((tr) => (
                <Badge key={tr.id} className="rounded-full border border-border/60 text-xs gap-1 pl-3 pr-2 group">
                  <span>{tr.country}</span>
                  {isOwn && (
                    <form
                      action={async () => {
                        const fd = new FormData();
                        fd.set("locale", localeStr);
                        fd.set("country", tr.country);
                        await removeTravelAction(fd);
                      }}
                      className="inline"
                    >
                      <button type="submit" className="ml-1 text-muted-foreground hover:text-destructive transition">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </form>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InterestsTab({
  interests,
  hobbies,
  isOwn,
  localeStr,
}: {
  interests: ProfileInterestRow[];
  hobbies: ProfileHobbyRow[];
  isOwn: boolean;
  localeStr: string;
}) {
  const t = useTranslations("ProfileAbout");
  const [interestInput, setInterestInput] = useState("");
  const [hobbyInput, setHobbyInput] = useState("");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart size={16} className="text-primary" />
            {t("interests_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {isOwn && (
            <form
              action={async (fd) => {
                await addInterestAction(fd);
                setInterestInput("");
              }}
              className="flex gap-2 mb-3"
            >
              <input type="hidden" name="locale" value={localeStr} />
              <Input
                name="name"
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                placeholder={t("interestPlaceholder")}
                className="text-sm flex-1"
              />
              <Button type="submit" size="sm" className="text-xs" disabled={!interestInput.trim()}>
                <Plus size={14} />
              </Button>
            </form>
          )}

          {interests.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">{t("noInterests")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {interests.map((interest) => (
                <Badge key={interest.id} className="rounded-full bg-muted text-xs gap-1 pl-3 pr-2 group">
                  <span>{interest.name}</span>
                  {isOwn && (
                    <form
                      action={async () => {
                        const fd = new FormData();
                        fd.set("locale", localeStr);
                        fd.set("name", interest.name);
                        await removeInterestAction(fd);
                      }}
                      className="inline"
                    >
                      <button type="submit" className="ml-0.5 text-muted-foreground hover:text-destructive transition">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </form>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart size={16} className="text-primary" />
            {t("hobbies_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {isOwn && (
            <form
              action={async (fd) => {
                await addHobbyAction(fd);
                setHobbyInput("");
              }}
              className="flex gap-2 mb-3"
            >
              <input type="hidden" name="locale" value={localeStr} />
              <Input
                name="name"
                value={hobbyInput}
                onChange={(e) => setHobbyInput(e.target.value)}
                placeholder={t("hobbyPlaceholder")}
                className="text-sm flex-1"
              />
              <Button type="submit" size="sm" className="text-xs" disabled={!hobbyInput.trim()}>
                <Plus size={14} />
              </Button>
            </form>
          )}

          {hobbies.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">{t("noHobbies")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {hobbies.map((hobby) => (
                <Badge key={hobby.id} className="rounded-full border border-border/60 text-xs gap-1 pl-3 pr-2 group">
                  <span>{hobby.name}</span>
                  {isOwn && (
                    <form
                      action={async () => {
                        const fd = new FormData();
                        fd.set("locale", localeStr);
                        fd.set("name", hobby.name);
                        await removeHobbyAction(fd);
                      }}
                      className="inline"
                    >
                      <button type="submit" className="ml-0.5 text-muted-foreground hover:text-destructive transition">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </form>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LinksTab({
  links,
  isOwn,
  localeStr,
}: {
  links: ProfileLinkRow[];
  isOwn: boolean;
  localeStr: string;
}) {
  const t = useTranslations("ProfileAbout");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const displayLinks = links.filter((l) => !["phone", "email", "whatsapp", "telegram", "instagram", "facebook", "linkedin"].includes(l.platform));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 size={16} className="text-primary" />
          {t("links")}
        </CardTitle>
        {isOwn && (
          <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} /> {t("addLink")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-2">
        {showForm && isOwn && (
          <form
            action={async (fd) => {
              const res = await addLinkAction(fd);
              if (!res.error) {
                setShowForm(false);
                const form = document.getElementById("link-form") as HTMLFormElement;
                form?.reset();
              }
            }}
            id="link-form"
            className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2 mb-3"
          >
            <input type="hidden" name="locale" value={localeStr} />
            <select
              name="platform"
              className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm outline-none ring-primary/30 focus:ring"
              required
            >
              <option value="">Select type...</option>
              {LINK_PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <Input name="value" placeholder={t("linkPlaceholder")} required className="text-sm" />
            <select
              name="visibility"
              className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm outline-none ring-primary/30 focus:ring"
            >
              <option value="public">{t("public")}</option>
              <option value="followers">{t("followers")}</option>
              <option value="only_me">{t("onlyMe")}</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="text-xs">{t("save")}</Button>
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setShowForm(false)}>{t("cancel")}</Button>
            </div>
          </form>
        )}

        {displayLinks.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground italic py-2">{t("noLinks")}</p>
        ) : (
          displayLinks.map((link) => {
            const platform = LINK_PLATFORMS.find((p) => p.value === link.platform);
            if (editingId === link.id) {
              return (
                <form
                  key={link.id}
                  action={async (fd) => {
                    const res = await updateLinkAction(fd);
                    if (!res.error) setEditingId(null);
                  }}
                  className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2"
                >
                  <input type="hidden" name="locale" value={localeStr} />
                  <input type="hidden" name="id" value={link.id} />
                  <Input name="value" defaultValue={link.value} placeholder={t("linkPlaceholder")} required className="text-sm" />
                  <select name="visibility" defaultValue={link.visibility} className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm outline-none ring-primary/30 focus:ring">
                    <option value="public">{t("public")}</option>
                    <option value="followers">{t("followers")}</option>
                    <option value="only_me">{t("onlyMe")}</option>
                  </select>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="text-xs">{t("save")}</Button>
                    <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setEditingId(null)}>{t("cancel")}</Button>
                    <form action={async () => {
                      const fd = new FormData();
                      fd.set("locale", localeStr);
                      fd.set("id", link.id);
                      await deleteLinkAction(fd);
                    }}>
                      <Button type="submit" variant="destructive" size="sm" className="text-xs">{t("delete")}</Button>
                    </form>
                  </div>
                </form>
              );
            }

            return (
              <div key={link.id} className="group flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 transition hover:border-primary/30">
                <a
                  href={link.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Globe size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{link.label || platform?.label || link.platform}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.value}</p>
                  </div>
                  <ExternalLink size={14} className="text-muted-foreground shrink-0 ml-auto" />
                </a>
                {isOwn && (
                  <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition">
                    <button type="button" onClick={() => setEditingId(link.id)} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

type ProfileTab = "overview" | "work" | "contact" | "places" | "interests" | "links";

const TAB_ICONS: Record<ProfileTab, React.ReactNode> = {
  overview: <UserRound size={16} />,
  work: <Briefcase size={16} />,
  contact: <Mail size={16} />,
  places: <MapPin size={16} />,
  interests: <Heart size={16} />,
  links: <Link2 size={16} />,
};

export function ProfileAbout({
  profile,
  work,
  education,
  interests,
  hobbies,
  links,
  travel,
  isOwnProfile,
}: ProfileAboutProps) {
  const t = useTranslations("ProfileAbout");
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  const tabs: {key: ProfileTab; label: string}[] = [
    {key: "overview", label: t("overview")},
    {key: "work", label: t("workAndEducation")},
    {key: "contact", label: t("contact")},
    {key: "places", label: t("places")},
    {key: "interests", label: t("interests")},
    {key: "links", label: t("links")},
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {TAB_ICONS[tab.key]}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab profile={profile} isOwn={isOwnProfile} />}
      {activeTab === "work" && <WorkEducationTab work={work} education={education} isOwn={isOwnProfile} localeStr={locale} />}
      {activeTab === "contact" && <ContactTab links={links} isOwn={isOwnProfile} localeStr={locale} />}
      {activeTab === "places" && <PlacesTab profile={profile} travel={travel} isOwn={isOwnProfile} localeStr={locale} />}
      {activeTab === "interests" && <InterestsTab interests={interests} hobbies={hobbies} isOwn={isOwnProfile} localeStr={locale} />}
      {activeTab === "links" && <LinksTab links={links} isOwn={isOwnProfile} localeStr={locale} />}
    </div>
  );
}
