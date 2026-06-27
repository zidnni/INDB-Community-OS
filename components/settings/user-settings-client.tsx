"use client";

import {useEffect, useMemo, useRef, useState, useTransition} from "react";
import type {ComponentType, ReactNode} from "react";
import Image from "next/image";
import {useSearchParams} from "next/navigation";
import {useTheme} from "next-themes";
import {toast} from "sonner";
import {
  Accessibility,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Globe2,
  Heart,
  HelpCircle,
  ImageIcon,
  Info,
  Languages,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Phone,
  Save,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  changePasswordFromSettingsAction,
  deactivateAccountAction,
  deleteAccountAction,
  logoutOtherDevicesAction,
  saveAccountSettingsAction,
  saveUserPreferencesAction,
} from "@/app/[locale]/(dashboard)/settings/actions";
import {signOutAction} from "@/app/[locale]/server-actions";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {prepareImageForUpload} from "@/lib/images/client-compression";
import {ACCEPTED_IMAGE_EXTENSIONS} from "@/lib/images/upload-config";
import {uploadFileToStorage} from "@/lib/images/client-upload";
import {Link, localeLabels, routing, usePathname, useRouter} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";
import type {
  ProfileRow,
  UserEmailVisibility,
  UserFontSizePreference,
  UserLastSeenVisibility,
  UserMessagePermission,
  UserNotificationKey,
  UserPhoneVisibility,
  UserSettingsRow,
  UserThemePreference,
} from "@/types/database";

type Labels = ReturnType<typeof labelsFor>;

interface UserSettingsClientProps {
  locale: string;
  profile: ProfileRow;
  settings: UserSettingsRow;
  authEmail: string | null;
  emailVerified: boolean;
  impact: {
    level: string;
    contribution_score: number;
    volunteer_hours: number;
    graatek_completed: number;
    memories_created: number;
    badges: string[];
  };
}

const sectionKeys = [
  "account",
  "appearance",
  "notifications",
  "privacy",
  "recognition",
  "security",
  "accessibility",
  "about",
  "actions",
] as const;

type SectionKey = (typeof sectionKeys)[number];

const notificationKeys: UserNotificationKey[] = [
  "messages",
  "comments",
  "reactions",
  "followers",
  "graatek",
  "campaigns",
  "volunteer",
  "announcements",
];

const sectionIcons = {
  account: UserRound,
  appearance: Palette,
  notifications: Bell,
  privacy: Shield,
  recognition: Heart,
  security: Lock,
  accessibility: Accessibility,
  about: Info,
  actions: AlertTriangle,
};

function labelsFor(locale: string) {
  const ar = {
    title: "⚙️ الإعدادات",
    subtitle: "مركز التحكم بحسابك وتفضيلاتك داخل I ❤️ NDB.\n\nيمكنك إدارة ملفك الشخصي، اللغة، الإشعارات، الخصوصية، والأمان من هنا.",
    save: "حفظ",
    saving: "جار الحفظ...",
    saved: "تم حفظ الإعدادات بنجاح",
    back: "رجوع",
    cancel: "إلغاء",
    unsavedWarning: "لديك تغييرات غير محفوظة. هل تريد مغادرة هذا القسم؟",
    uploadFailed: "تعذر رفع الصورة",
    saveFailed: "تعذر الحفظ. حاول مرة أخرى.",
    choosePhoto: "تغيير الصورة",
    chooseCover: "تغيير الغلاف",
    verified: "موثق",
    notVerified: "غير موثق",
    privateByDefault: "يبقى رقم الهاتف والبريد خاصين افتراضياً.",
    editProfile: "حفظ الملف الشخصي",
    sections: {
      account: "الحساب",
      appearance: "اللغة والمظهر",
      notifications: "الإشعارات",
      privacy: "الخصوصية",
      recognition: "التقدير المجتمعي",
      security: "الأمان",
      accessibility: "إمكانية الوصول",
      about: "حول",
      actions: "إجراءات الحساب",
    },
    account: {
      fullName: "الاسم الكامل",
      username: "اسم المستخدم",
      phone: "رقم الهاتف",
      email: "البريد الإلكتروني",
      bio: "نبذة",
      city: "المدينة",
      neighborhood: "الحي",
      usernameHint: "3 إلى 24 حرفاً: حروف لاتينية، أرقام، نقطة أو شرطة.",
      changePassword: "تغيير كلمة المرور",
    },
    appearance: {
      language: "اللغة",
      theme: "المظهر",
      light: "نهاري",
      dark: "ليلي",
      system: "حسب النظام",
    },
    notifications: {
      inApp: "داخل التطبيق",
      email: "البريد الإلكتروني",
      messages: "الرسائل",
      comments: "التعليقات",
      reactions: "التفاعلات",
      followers: "المتابعون",
      graatek: "طلبات گرعتك",
      campaigns: "تحديثات الحملات",
      volunteer: "فرص التطوع",
      announcements: "إعلانات المنصة",
    },
    privacy: {
      whoMessage: "من يمكنه مراسلتي؟",
      personalInfo: "المعلومات الشخصية",
      communityContributions: "المساهمات المجتمعية",
      activity: "النشاط",
      everyone: "الجميع",
      followers: "المتابعون فقط",
      noOne: "لا أحد",
      onlyMe: "أنا فقط",
      showRecognition: "إظهار التقدير المجتمعي",
      showVolunteer: "إظهار ساعات التطوع",
      showGraatek: "إظهار گرعتك المكتملة",
      showMemories: "إظهار الذكريات",
      showOnline: "إظهار حالة الاتصال",
      lastSeen: "من يمكنه رؤية آخر ظهور؟",
      phoneVisibility: "من يمكنه رؤية رقم الهاتف؟",
      emailVisibility: "من يمكنه رؤية البريد الإلكتروني؟",
    },
    recognition: {
      level: "المستوى المجتمعي",
      badges: "الشارات",
      summary: "ملخص المساهمات",
      donations: "إظهار تقدير التبرعات",
      volunteerRecognition: "إظهار تقدير التطوع",
      score: "النقاط",
      hours: "ساعات التطوع",
      graatek: "تبادلات گرعتك",
      memories: "الذكريات",
    },
    security: {
      emailStatus: "حالة البريد",
      phoneStatus: "حالة الهاتف",
      lastLogin: "آخر دخول",
      activeSessions: "الجلسات النشطة",
      currentSession: "الجلسة الحالية",
      newPassword: "كلمة مرور جديدة",
      confirmPassword: "تأكيد كلمة المرور",
      updatePassword: "تحديث كلمة المرور",
      logoutOthers: "تسجيل الخروج من الأجهزة الأخرى",
      twoFactor: "التحقق الثنائي جاهز للمرحلة القادمة",
      passwordUpdated: "تم تغيير كلمة المرور",
      sessionsCleared: "تم تسجيل الخروج من الأجهزة الأخرى",
    },
    accessibility: {
      fontSize: "حجم الخط",
      small: "صغير",
      medium: "متوسط",
      large: "كبير",
      highContrast: "تباين عالٍ",
      reduceAnimations: "تقليل الحركة",
    },
    about: {
      version: "إصدار المنصة",
      privacy: "سياسة الخصوصية",
      terms: "شروط الاستخدام",
      guidelines: "إرشادات المجتمع",
      help: "مركز المساعدة",
      contact: "التواصل مع الدعم",
      about: "عن I ❤️ NDB",
    },
    actions: {
      logout: "تسجيل الخروج",
      deactivate: "تعطيل الحساب",
      delete: "حذف الحساب نهائياً",
      deleteHint: "اكتب DELETE لتأكيد الحذف النهائي.",
      confirmation: "كلمة التأكيد",
      deactivateDone: "تم تعطيل الحساب",
      deleteFailed: "تعذر حذف الحساب",
    },
  };

  const fr: typeof ar = {
    title: "Paramètres",
    subtitle: "Votre centre de contrôle personnel pour le compte et l'expérience I ❤️ NDB.",
    save: "Enregistrer",
    saving: "Enregistrement...",
    saved: "Paramètres enregistrés",
    back: "Retour",
    cancel: "Annuler",
    unsavedWarning: "Vous avez des modifications non enregistrées. Quitter cette section ?",
    uploadFailed: "Impossible de téléverser l'image",
    saveFailed: "Impossible d'enregistrer. Réessayez.",
    choosePhoto: "Changer la photo",
    chooseCover: "Changer la couverture",
    verified: "Vérifié",
    notVerified: "Non vérifié",
    privateByDefault: "Le téléphone et l'e-mail restent privés par défaut.",
    editProfile: "Enregistrer le profil",
    sections: {
      account: "Compte",
      appearance: "Langue et apparence",
      notifications: "Notifications",
      privacy: "Confidentialité",
      recognition: "Reconnaissance",
      security: "Sécurité",
      accessibility: "Accessibilité",
      about: "À propos",
      actions: "Actions du compte",
    },
    account: {
      fullName: "Nom complet",
      username: "Nom d'utilisateur",
      phone: "Téléphone",
      email: "E-mail",
      bio: "Bio",
      city: "Ville",
      neighborhood: "Quartier",
      usernameHint: "3 à 24 caractères: lettres latines, chiffres, point ou tiret.",
      changePassword: "Changer le mot de passe",
    },
    appearance: {
      language: "Langue",
      theme: "Thème",
      light: "Clair",
      dark: "Sombre",
      system: "Système",
    },
    notifications: {
      inApp: "Dans l'application",
      email: "E-mail",
      messages: "Messages",
      comments: "Commentaires",
      reactions: "Réactions",
      followers: "Abonnés",
      graatek: "Demandes Graatek",
      campaigns: "Mises à jour campagnes",
      volunteer: "Opportunités bénévolat",
      announcements: "Annonces plateforme",
    },
    privacy: {
      whoMessage: "Qui peut m'envoyer un message ?",
      personalInfo: "Informations personnelles",
      communityContributions: "Contributions communautaires",
      activity: "Activité",
      everyone: "Tout le monde",
      followers: "Abonnés uniquement",
      noOne: "Personne",
      onlyMe: "Moi seulement",
      showRecognition: "Afficher la reconnaissance",
      showVolunteer: "Afficher les heures bénévoles",
      showGraatek: "Afficher Graatek terminé",
      showMemories: "Afficher les souvenirs",
      showOnline: "Afficher le statut en ligne",
      lastSeen: "Qui peut voir ma dernière activité ?",
      phoneVisibility: "Qui peut voir mon téléphone ?",
      emailVisibility: "Qui peut voir mon e-mail ?",
    },
    recognition: {
      level: "Niveau communautaire",
      badges: "Badges",
      summary: "Résumé des contributions",
      donations: "Afficher la reconnaissance des dons",
      volunteerRecognition: "Afficher la reconnaissance bénévole",
      score: "Points",
      hours: "Heures bénévoles",
      graatek: "Échanges Graatek",
      memories: "Souvenirs",
    },
    security: {
      emailStatus: "Statut e-mail",
      phoneStatus: "Statut téléphone",
      lastLogin: "Dernière connexion",
      activeSessions: "Sessions actives",
      currentSession: "Session actuelle",
      newPassword: "Nouveau mot de passe",
      confirmPassword: "Confirmer le mot de passe",
      updatePassword: "Mettre à jour",
      logoutOthers: "Déconnecter les autres appareils",
      twoFactor: "Architecture prête pour la double authentification",
      passwordUpdated: "Mot de passe changé",
      sessionsCleared: "Autres appareils déconnectés",
    },
    accessibility: {
      fontSize: "Taille du texte",
      small: "Petit",
      medium: "Moyen",
      large: "Grand",
      highContrast: "Contraste élevé",
      reduceAnimations: "Réduire les animations",
    },
    about: {
      version: "Version de la plateforme",
      privacy: "Politique de confidentialité",
      terms: "Conditions d'utilisation",
      guidelines: "Règles de communauté",
      help: "Centre d'aide",
      contact: "Contacter le support",
      about: "À propos de I ❤️ NDB",
    },
    actions: {
      logout: "Se déconnecter",
      deactivate: "Désactiver le compte",
      delete: "Supprimer définitivement",
      deleteHint: "Tapez DELETE pour confirmer la suppression.",
      confirmation: "Mot de confirmation",
      deactivateDone: "Compte désactivé",
      deleteFailed: "Impossible de supprimer le compte",
    },
  };

  const en: typeof ar = {
    title: "Settings",
    subtitle: "Your personal control center for your account and I ❤️ NDB experience.",
    save: "Save",
    saving: "Saving...",
    saved: "Settings saved",
    back: "Back",
    cancel: "Cancel",
    unsavedWarning: "You have unsaved changes. Leave this section?",
    uploadFailed: "Could not upload image",
    saveFailed: "Could not save. Try again.",
    choosePhoto: "Change photo",
    chooseCover: "Change cover",
    verified: "Verified",
    notVerified: "Not verified",
    privateByDefault: "Phone and email stay private by default.",
    editProfile: "Save profile",
    sections: {
      account: "Account",
      appearance: "Language & appearance",
      notifications: "Notifications",
      privacy: "Privacy",
      recognition: "Community recognition",
      security: "Security",
      accessibility: "Accessibility",
      about: "About",
      actions: "Account actions",
    },
    account: {
      fullName: "Full name",
      username: "Username",
      phone: "Phone number",
      email: "Email",
      bio: "Bio",
      city: "City",
      neighborhood: "Neighborhood",
      usernameHint: "3 to 24 characters: Latin letters, numbers, dot or dash.",
      changePassword: "Change password",
    },
    appearance: {
      language: "Language",
      theme: "Theme",
      light: "Light",
      dark: "Dark",
      system: "System",
    },
    notifications: {
      inApp: "In-app",
      email: "Email",
      messages: "Messages",
      comments: "Comments",
      reactions: "Reactions",
      followers: "Followers",
      graatek: "Graatek requests",
      campaigns: "Campaign updates",
      volunteer: "Volunteer opportunities",
      announcements: "Platform announcements",
    },
    privacy: {
      whoMessage: "Who can message me?",
      personalInfo: "Personal Information",
      communityContributions: "Community Contributions",
      activity: "Activity",
      everyone: "Everyone",
      followers: "Followers only",
      noOne: "No one",
      onlyMe: "Only me",
      showRecognition: "Show community recognition",
      showVolunteer: "Show volunteer hours",
      showGraatek: "Show completed Graatek",
      showMemories: "Show memories",
      showOnline: "Show online status",
      lastSeen: "Who can see my last seen?",
      phoneVisibility: "Who can see my phone number?",
      emailVisibility: "Who can see my email?",
    },
    recognition: {
      level: "Community level",
      badges: "Badges",
      summary: "Contribution summary",
      donations: "Show donation recognition",
      volunteerRecognition: "Show volunteer recognition",
      score: "Points",
      hours: "Volunteer hours",
      graatek: "Graatek exchanges",
      memories: "Memories",
    },
    security: {
      emailStatus: "Email status",
      phoneStatus: "Phone status",
      lastLogin: "Last login",
      activeSessions: "Active sessions",
      currentSession: "Current session",
      newPassword: "New password",
      confirmPassword: "Confirm password",
      updatePassword: "Update password",
      logoutOthers: "Log out other devices",
      twoFactor: "Two-factor architecture is ready for a future phase",
      passwordUpdated: "Password changed",
      sessionsCleared: "Other devices signed out",
    },
    accessibility: {
      fontSize: "Font size",
      small: "Small",
      medium: "Medium",
      large: "Large",
      highContrast: "High contrast",
      reduceAnimations: "Reduce animations",
    },
    about: {
      version: "Platform version",
      privacy: "Privacy policy",
      terms: "Terms of service",
      guidelines: "Community guidelines",
      help: "Help center",
      contact: "Contact support",
      about: "About I ❤️ NDB",
    },
    actions: {
      logout: "Log out",
      deactivate: "Deactivate account",
      delete: "Permanently delete account",
      deleteHint: "Type DELETE to confirm permanent deletion.",
      confirmation: "Confirmation word",
      deactivateDone: "Account deactivated",
      deleteFailed: "Could not delete account",
    },
  };

  if (locale === "ar") return ar;
  if (locale === "fr") return fr;
  return en;
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SelectRow<T extends string>({value, onChange, label, options}: {value: T; onChange: (v: T) => void; label: string; options: {value: T; label: string}[]}) {
  return (
    <div className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-3 py-2">
      <span className="text-sm font-bold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className="h-10 rounded-xl border border-border bg-transparent px-3 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      >
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-start transition hover:bg-muted/60 active:scale-[0.99]"
    >
      <span className="text-sm font-bold">{label}</span>
      <span
        className={cn(
          "relative h-7 w-12 rounded-full transition",
          checked ? "bg-primary" : "bg-muted-foreground/25",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition",
            checked ? "end-1" : "start-1",
          )}
        />
      </span>
    </button>
  );
}

function SectionCard({
  id,
  title,
  icon: Icon,
  visible = true,
  children,
}: {
  id: string;
  title: string;
  icon: ComponentType<{size?: number; className?: string}>;
  visible?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-3xl border border-border/70 bg-card p-4 shadow-[0_14px_34px_rgba(7,31,54,0.06)] sm:p-5",
        !visible && "hidden",
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon size={21} />
        </span>
        <h2 className="text-xl font-black">{title}</h2>
      </div>
      {visible ? children : null}
    </section>
  );
}

function Field({label, children, hint}: {label: string; children: React.ReactNode; hint?: string}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function UserSettingsClient({
  locale,
  profile,
  settings,
  authEmail,
  emailVerified,
  impact,
}: UserSettingsClientProps) {
  const labels = useMemo(() => labelsFor(locale), [locale]);
  const isRtl = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {theme, setTheme} = useTheme();
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const [isPending, startTransition] = useTransition();
  const [imageUploading, setImageUploading] = useState(false);
  const initialAccount = useMemo(() => ({
    fullName: profile.full_name ?? "",
    username: profile.username ?? "",
    phone: profile.phone ?? "",
    contactEmail: settings.contact_email ?? (authEmail?.endsWith("@phone.indb.local") ? "" : authEmail ?? ""),
    bio: profile.bio ?? "",
    city: profile.city ?? "Nouadhibou",
    neighborhood: profile.hometown ?? "",
    avatarUrl: profile.avatar_url,
    coverImageUrl: profile.cover_image_url,
  }), [authEmail, profile]);
  const [account, setAccount] = useState(initialAccount);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url);
  const [coverPreview, setCoverPreview] = useState(profile.cover_image_url);
  const [password, setPassword] = useState({password: "", confirmPassword: ""});
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [accountDirty, setAccountDirty] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    language: profile.language_preference && routing.locales.includes(profile.language_preference as never)
      ? profile.language_preference
      : locale,
    theme: settings.theme,
    messagePermission: settings.message_permission,
    showCommunityRecognition: settings.show_community_recognition,
    showVolunteerHours: settings.show_volunteer_hours,
    showCompletedGraatek: settings.show_completed_graatek,
    showMemories: settings.show_memories,
    showOnlineStatus: settings.show_online_status,
    lastSeenVisibility: settings.last_seen_visibility,
    phoneVisibility: settings.phone_visibility,
    emailVisibility: settings.email_visibility,
    recognitionVisibility: settings.recognition_visibility,
    inAppNotifications: settings.in_app_notifications,
    emailNotifications: settings.email_notifications,
    fontSize: settings.font_size,
    highContrast: settings.high_contrast,
    reduceAnimations: settings.reduce_animations,
  });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const selectedSection = activeSection ?? "account";

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontSize = preferences.fontSize;
    root.dataset.highContrast = preferences.highContrast ? "true" : "false";
    root.dataset.reduceAnimations = preferences.reduceAnimations ? "true" : "false";
  }, [preferences.fontSize, preferences.highContrast, preferences.reduceAnimations]);

  useEffect(() => {
    if (!accountDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [accountDirty]);

  function openSection(section: SectionKey | null) {
    if (accountDirty && section !== "account" && !window.confirm(labels.unsavedWarning)) {
      return;
    }
    setActiveSection(section);
    if (typeof window !== "undefined") {
      window.scrollTo({top: 0, behavior: preferences.reduceAnimations ? "auto" : "smooth"});
    }
  }

  async function persistPreferences(nextPreferences: typeof preferences, showToast = false) {
    setPreferencesSaving(true);
    const result = await saveUserPreferencesAction({locale, ...nextPreferences});
    setPreferencesSaving(false);
    if (result.success) {
      if (showToast) toast.success(labels.saved);
      router.refresh();
      return true;
    } else {
      toast.error(labels.saveFailed);
      return false;
    }
  }

  function setPreference<K extends keyof typeof preferences>(key: K, value: (typeof preferences)[K]) {
    const nextPreferences = {...preferences, [key]: value};
    setPreferences(nextPreferences);
    void persistPreferences(nextPreferences);
  }

  function savePrivacyPreference<K extends keyof typeof preferences>(
    key: K,
    value: (typeof preferences)[K],
  ) {
    const next = {...preferences, [key]: value};
    setPreferences(next);
    void persistPreferences(next, true);
  }

  function setAccountField<K extends keyof typeof account>(key: K, value: (typeof account)[K]) {
    setAccount((current) => ({...current, [key]: value}));
    setAccountDirty(true);
  }

  function changeLanguage(nextLocale: string) {
    const nextPreferences = {...preferences, language: nextLocale};
    setPreferences(nextPreferences);
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    try {
      localStorage.setItem("preferred-locale", nextLocale);
    } catch {}

    void fetch("/api/locale", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({locale: nextLocale}),
    });

    const query = searchParams.toString();
    void persistPreferences(nextPreferences);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {locale: nextLocale as never});
  }

  function changeTheme(nextTheme: UserThemePreference) {
    const nextPreferences = {...preferences, theme: nextTheme};
    setPreferences(nextPreferences);
    setTheme(nextTheme);
    document.cookie = `theme=${nextTheme};path=/;max-age=31536000;samesite=lax`;
    void persistPreferences(nextPreferences);
  }

  async function uploadProfileImage(file: File, kind: "avatar" | "cover") {
    setImageUploading(true);
    try {
      const prepared = await prepareImageForUpload(file, kind);
      const bucket = kind === "avatar" ? "avatars" : "profile-covers";
      const prefix = `${profile.id}/settings/${kind}`;
      const uploaded = await uploadFileToStorage(prepared, bucket, prefix);
      const nextAccount = kind === "avatar"
        ? {...account, avatarUrl: uploaded.url}
        : {...account, coverImageUrl: uploaded.url};

      if (kind === "avatar") {
        setAvatarPreview(uploaded.url);
        setAccountField("avatarUrl", uploaded.url);
      } else {
        setCoverPreview(uploaded.url);
        setAccountField("coverImageUrl", uploaded.url);
      }

      const result = await saveAccountSettingsAction({locale, ...nextAccount});
      if (!result.success) {
        toast.error(labels.saveFailed);
        return;
      }

      toast.success(labels.saved);
      setAccountDirty(false);
      router.refresh();
    } catch {
      toast.error(labels.uploadFailed);
    } finally {
      setImageUploading(false);
    }
  }

  async function saveAccount() {
    startTransition(async () => {
      const result = await saveAccountSettingsAction({locale, ...account});
      if (result.success) {
        toast.success(labels.saved);
        setAccountDirty(false);
        router.refresh();
      } else {
        toast.error(labels.saveFailed);
      }
    });
  }

  async function savePreferences() {
    startTransition(async () => {
      await persistPreferences(preferences, true);
    });
  }

  function cancelAccountChanges() {
    setAccount(initialAccount);
    setAvatarPreview(initialAccount.avatarUrl);
    setCoverPreview(initialAccount.coverImageUrl);
    setAccountDirty(false);
  }

  async function updatePassword() {
    startTransition(async () => {
      const result = await changePasswordFromSettingsAction({locale, ...password});
      if (result.success) {
        toast.success(labels.security.passwordUpdated);
        setPassword({password: "", confirmPassword: ""});
      } else {
        toast.error(labels.saveFailed);
      }
    });
  }

  async function logoutOthers() {
    startTransition(async () => {
      const result = await logoutOtherDevicesAction();
      if (result.success) toast.success(labels.security.sessionsCleared);
      else toast.error(labels.saveFailed);
    });
  }

  async function deactivate() {
    startTransition(async () => {
      const result = await deactivateAccountAction(locale);
      if (!result?.success) toast.error(labels.saveFailed);
    });
  }

  async function deleteAccount() {
    startTransition(async () => {
      const result = await deleteAccountAction({locale, confirmation: deleteConfirmation});
      if (!result?.success) toast.error(labels.actions.deleteFailed);
    });
  }

  const themeOptions: Array<{value: UserThemePreference; label: string; icon: typeof Sun}> = [
    {value: "light", label: labels.appearance.light, icon: Sun},
    {value: "dark", label: labels.appearance.dark, icon: Moon},
    {value: "system", label: labels.appearance.system, icon: Monitor},
  ];

  const messageOptions: Array<{value: UserMessagePermission; label: string}> = [
    {value: "everyone", label: labels.privacy.everyone},
    {value: "followers", label: labels.privacy.followers},
    {value: "no_one", label: labels.privacy.noOne},
  ];

  const lastSeenOptions: Array<{value: UserLastSeenVisibility; label: string}> = [
    {value: "everyone", label: labels.privacy.everyone},
    {value: "no_one", label: labels.privacy.noOne},
  ];

  const phoneVisibilityOptions: Array<{value: UserPhoneVisibility; label: string}> = [
    {value: "only_me", label: labels.privacy.onlyMe},
    {value: "followers", label: labels.privacy.followers},
    {value: "no_one", label: labels.privacy.noOne},
  ];

  const emailVisibilityOptions: Array<{value: UserEmailVisibility; label: string}> = [
    {value: "only_me", label: labels.privacy.onlyMe},
    {value: "no_one", label: labels.privacy.noOne},
  ];

  return (
    <div className="mx-auto max-w-6xl pb-24" dir={isRtl ? "rtl" : "ltr"}>
      <header className="mb-4 rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-amber-400/10 p-5 shadow-[0_18px_50px_rgba(8,33,56,0.08)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-primary">I ❤️ NDB</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{labels.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{labels.subtitle}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={cn("lg:sticky lg:top-24 lg:self-start", activeSection && "hidden lg:block")}>
          <nav className="grid gap-2 rounded-3xl border border-border/70 bg-card p-2">
            {sectionKeys.map((key) => {
              const Icon = sectionIcons[key];
              const active = selectedSection === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => openSection(key)}
                  className={cn(
                    "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-3 text-start text-sm font-black transition active:scale-[0.98]",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon size={18} />
                    {labels.sections[key]}
                  </span>
                  <ChevronRight size={16} className={cn(isRtl && "rotate-180")} />
                </button>
              );
            })}
          </nav>
        </aside>

        <main className={cn("space-y-4", !activeSection && "hidden lg:block")}>
          {activeSection ? (
            <button
              type="button"
              onClick={() => openSection(null)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-black text-muted-foreground shadow-sm lg:hidden"
            >
              <ArrowLeft size={18} className={cn(isRtl && "rotate-180")} />
              {labels.back}
            </button>
          ) : null}

          <SectionCard id="account" title={labels.sections.account} icon={UserRound} visible={selectedSection === "account"}>
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-muted/25">
              <div className="relative h-36 bg-muted sm:h-44">
                {coverPreview ? (
                  <Image src={coverPreview} alt="" fill sizes="(max-width: 768px) 100vw, 760px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageIcon size={34} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute bottom-3 end-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-card/95 px-4 text-sm font-black shadow-lg"
                  disabled={imageUploading}
                >
                  <Camera size={16} />
                  {labels.chooseCover}
                </button>
              </div>
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
                <div className="-mt-14 flex flex-col items-center gap-2 sm:items-start">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-muted shadow-lg"
                    disabled={imageUploading}
                  >
                    {avatarPreview ? (
                      <Image src={avatarPreview} alt="" fill sizes="112px" className="object-cover" />
                    ) : (
                      <UserRound size={38} className="text-muted-foreground" />
                    )}
                    <span className="absolute inset-x-0 bottom-0 flex h-9 items-center justify-center bg-black/45 text-white">
                      <Camera size={16} />
                    </span>
                  </button>
                  <button type="button" onClick={() => avatarInputRef.current?.click()} className="text-xs font-black text-primary">
                    {labels.choosePhoto}
                  </button>
                </div>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">{labels.privateByDefault}</p>
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_EXTENSIONS}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadProfileImage(file, "avatar");
              }}
            />
            <input
              ref={coverInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_EXTENSIONS}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadProfileImage(file, "cover");
              }}
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={labels.account.fullName}>
                <Input value={account.fullName} onChange={(event) => setAccountField("fullName", event.target.value)} />
              </Field>
              <Field label={labels.account.username} hint={labels.account.usernameHint}>
                <Input value={account.username} onChange={(event) => setAccountField("username", event.target.value)} />
              </Field>
              <Field label={labels.account.phone}>
                <Input value={account.phone} onChange={(event) => setAccountField("phone", event.target.value)} inputMode="tel" />
              </Field>
              <Field label={labels.account.email}>
                <Input value={account.contactEmail} onChange={(event) => setAccountField("contactEmail", event.target.value)} inputMode="email" />
              </Field>
              <Field label={labels.account.city}>
                <Input value={account.city} onChange={(event) => setAccountField("city", event.target.value)} />
              </Field>
              <Field label={labels.account.neighborhood}>
                <Input value={account.neighborhood} onChange={(event) => setAccountField("neighborhood", event.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label={labels.account.bio}>
                  <Textarea value={account.bio} onChange={(event) => setAccountField("bio", event.target.value)} />
                </Field>
              </div>
            </div>
            <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 mt-4 flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/95 p-2 backdrop-blur sm:static sm:flex-row sm:border-0 sm:bg-transparent sm:p-0">
              <Button onClick={saveAccount} disabled={isPending || imageUploading || !accountDirty} className="w-full gap-2 sm:w-auto">
                <Save size={17} />
                {isPending ? labels.saving : labels.editProfile}
              </Button>
              <Button type="button" variant="outline" onClick={cancelAccountChanges} disabled={!accountDirty || isPending || imageUploading} className="w-full sm:w-auto">
                {labels.cancel}
              </Button>
            </div>
          </SectionCard>

          <SectionCard id="appearance" title={labels.sections.appearance} icon={Palette} visible={selectedSection === "appearance"}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                <label className="mb-2 flex items-center gap-2 text-sm font-black" htmlFor="settings-language">
                  <Languages size={18} className="text-primary" />
                  {labels.appearance.language}
                </label>
                <select
                  id="settings-language"
                  value={preferences.language}
                  onChange={(event) => changeLanguage(event.target.value)}
                  className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {routing.locales.map((item) => (
                    <option key={item} value={item}>
                      {localeLabels[item]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-black">
                  <Globe2 size={18} className="text-primary" />
                  {labels.appearance.theme}
                </p>
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1">
                  {themeOptions.map((option) => {
                    const Icon = option.icon;
                    const active = preferences.theme === option.value || (!preferences.theme && theme === option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => changeTheme(option.value)}
                        className={cn(
                          "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs font-black transition",
                          active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                        )}
                      >
                        <Icon size={17} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <Button onClick={savePreferences} disabled={isPending || preferencesSaving} className="mt-4 w-full gap-2 sm:w-auto">
              <Save size={17} />
              {isPending || preferencesSaving ? labels.saving : labels.save}
            </Button>
          </SectionCard>

          <SectionCard id="notifications" title={labels.sections.notifications} icon={Bell} visible={selectedSection === "notifications"}>
            <div className="overflow-hidden rounded-2xl border border-border/70">
              <div className="grid grid-cols-[minmax(0,1fr)_86px_86px] gap-2 bg-muted/40 px-3 py-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                <span>{labels.sections.notifications}</span>
                <span className="text-center">{labels.notifications.inApp}</span>
                <span className="text-center">{labels.notifications.email}</span>
              </div>
              {notificationKeys.map((key) => (
                <div key={key} className="grid min-h-13 grid-cols-[minmax(0,1fr)_86px_86px] items-center gap-2 border-t border-border/60 px-3 py-2">
                  <span className="text-sm font-bold">{labels.notifications[key]}</span>
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={preferences.inAppNotifications[key]}
                      onChange={(event) => setPreference("inAppNotifications", {...preferences.inAppNotifications, [key]: event.target.checked})}
                      className="h-5 w-5 accent-primary"
                    />
                  </div>
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={preferences.emailNotifications[key]}
                      onChange={(event) => setPreference("emailNotifications", {...preferences.emailNotifications, [key]: event.target.checked})}
                      className="h-5 w-5 accent-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={savePreferences} disabled={isPending || preferencesSaving} className="mt-4 w-full gap-2 sm:w-auto">
              <Save size={17} />
              {isPending || preferencesSaving ? labels.saving : labels.save}
            </Button>
          </SectionCard>

          <SectionCard id="privacy" title={labels.sections.privacy} icon={Shield} visible={selectedSection === "privacy"}>
            <div className="space-y-1">
              <p className="px-3 pb-1 pt-2 text-xs font-black uppercase tracking-wider text-muted-foreground">💬 {labels.privacy.whoMessage}</p>
              <div className="space-y-0.5">
                {messageOptions.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => savePrivacyPreference("messagePermission", opt.value as typeof preferences.messagePermission)}
                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-start transition hover:bg-muted/60 active:scale-[0.99] ${preferences.messagePermission === opt.value ? "bg-primary/5" : ""}`}
                  >
                    <span className={`text-sm font-bold ${preferences.messagePermission === opt.value ? "text-primary" : "text-foreground"}`}>{opt.label}</span>
                    {preferences.messagePermission === opt.value ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">✓</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-1">
              <p className="px-3 pb-1 pt-2 text-xs font-black uppercase tracking-wider text-muted-foreground">📱 {labels.privacy.personalInfo}</p>
              <SelectRow value={preferences.phoneVisibility} onChange={(v) => savePrivacyPreference("phoneVisibility", v)} label={labels.privacy.phoneVisibility} options={phoneVisibilityOptions} />
              <SelectRow value={preferences.emailVisibility} onChange={(v) => savePrivacyPreference("emailVisibility", v)} label={labels.privacy.emailVisibility} options={emailVisibilityOptions} />
            </div>

            <div className="mt-4 space-y-1">
              <p className="px-3 pb-1 pt-2 text-xs font-black uppercase tracking-wider text-muted-foreground">❤️ {labels.privacy.communityContributions}</p>
              <Toggle checked={preferences.showCommunityRecognition} onChange={(v) => savePrivacyPreference("showCommunityRecognition", v)} label={labels.privacy.showRecognition} />
              <Toggle checked={preferences.showVolunteerHours} onChange={(v) => savePrivacyPreference("showVolunteerHours", v)} label={labels.privacy.showVolunteer} />
              <Toggle checked={preferences.showCompletedGraatek} onChange={(v) => savePrivacyPreference("showCompletedGraatek", v)} label={labels.privacy.showGraatek} />
              <Toggle checked={preferences.showMemories} onChange={(v) => savePrivacyPreference("showMemories", v)} label={labels.privacy.showMemories} />
            </div>

            <div className="mt-4 space-y-1">
              <p className="px-3 pb-1 pt-2 text-xs font-black uppercase tracking-wider text-muted-foreground">💬 {labels.privacy.activity}</p>
              <SelectRow value={preferences.lastSeenVisibility} onChange={(v) => savePrivacyPreference("lastSeenVisibility", v)} label={labels.privacy.lastSeen} options={lastSeenOptions} />
              <Toggle checked={preferences.showOnlineStatus} onChange={(v) => savePrivacyPreference("showOnlineStatus", v)} label={labels.privacy.showOnline} />
            </div>
          </SectionCard>

          <SectionCard id="recognition" title={labels.sections.recognition} icon={Heart} visible={selectedSection === "recognition"}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [labels.recognition.level, impact.level, Sparkles],
                [labels.recognition.score, String(impact.contribution_score), Heart],
                [labels.recognition.hours, String(impact.volunteer_hours), CheckCircle2],
                [labels.recognition.graatek, String(impact.graatek_completed), Eye],
              ].map(([label, value, Icon]) => (
                <div key={label as string} className="rounded-2xl bg-muted/35 p-4">
                  <Icon size={19} className="text-primary" />
                  <p className="mt-3 text-2xl font-black">{value as string}</p>
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 rounded-2xl border border-border/70 p-2 md:grid-cols-2">
              <Toggle checked={preferences.recognitionVisibility.level} onChange={(value) => setPreference("recognitionVisibility", {...preferences.recognitionVisibility, level: value})} label={labels.recognition.level} />
              <Toggle checked={preferences.recognitionVisibility.badges} onChange={(value) => setPreference("recognitionVisibility", {...preferences.recognitionVisibility, badges: value})} label={labels.recognition.badges} />
              <Toggle checked={preferences.recognitionVisibility.summary} onChange={(value) => setPreference("recognitionVisibility", {...preferences.recognitionVisibility, summary: value})} label={labels.recognition.summary} />
              <Toggle checked={preferences.recognitionVisibility.donations} onChange={(value) => setPreference("recognitionVisibility", {...preferences.recognitionVisibility, donations: value})} label={labels.recognition.donations} />
              <Toggle checked={preferences.recognitionVisibility.volunteer} onChange={(value) => setPreference("recognitionVisibility", {...preferences.recognitionVisibility, volunteer: value})} label={labels.recognition.volunteerRecognition} />
            </div>
            <Button onClick={savePreferences} disabled={isPending || preferencesSaving} className="mt-4 w-full gap-2 sm:w-auto">
              <Save size={17} />
              {isPending || preferencesSaving ? labels.saving : labels.save}
            </Button>
          </SectionCard>

          <SectionCard id="security" title={labels.sections.security} icon={Lock} visible={selectedSection === "security"}>
            <div className="grid gap-3 md:grid-cols-2">
              <StatusRow icon={emailVerified ? CheckCircle2 : AlertTriangle} label={labels.security.emailStatus} value={emailVerified ? labels.verified : labels.notVerified} />
              <StatusRow icon={profile.phone_verified ? CheckCircle2 : AlertTriangle} label={labels.security.phoneStatus} value={profile.phone_verified ? labels.verified : labels.notVerified} />
              <StatusRow icon={LogOut} label={labels.security.lastLogin} value={formatDate(profile.last_login, locale)} />
              <StatusRow icon={Monitor} label={labels.security.activeSessions} value={`1 ${labels.security.currentSession}`} />
            </div>
            <div className="mt-4 rounded-2xl border border-border/70 p-3">
              <p className="mb-3 text-sm font-black">{labels.account.changePassword}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={labels.security.newPassword}>
                  <Input type="password" value={password.password} onChange={(event) => setPassword((current) => ({...current, password: event.target.value}))} autoComplete="new-password" />
                </Field>
                <Field label={labels.security.confirmPassword}>
                  <Input type="password" value={password.confirmPassword} onChange={(event) => setPassword((current) => ({...current, confirmPassword: event.target.value}))} autoComplete="new-password" />
                </Field>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button onClick={updatePassword} disabled={isPending || password.password.length === 0} className="gap-2">
                  <Lock size={17} />
                  {labels.security.updatePassword}
                </Button>
                <Button variant="outline" onClick={logoutOthers} disabled={isPending} className="gap-2">
                  <LogOut size={17} />
                  {labels.security.logoutOthers}
                </Button>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-dashed border-border/80 bg-muted/25 p-4 text-sm font-bold text-muted-foreground">
              {labels.security.twoFactor}
            </div>
          </SectionCard>

          <SectionCard id="accessibility" title={labels.sections.accessibility} icon={Accessibility} visible={selectedSection === "accessibility"}>
            <div className="grid gap-3 lg:grid-cols-3">
              {(["small", "medium", "large"] as UserFontSizePreference[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPreference("fontSize", size)}
                  className={cn(
                    "min-h-13 rounded-2xl border px-4 text-sm font-black transition",
                    preferences.fontSize === size ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/25",
                  )}
                >
                  {labels.accessibility[size]}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2 rounded-2xl border border-border/70 p-2 md:grid-cols-2">
              <Toggle checked={preferences.highContrast} onChange={(value) => setPreference("highContrast", value)} label={labels.accessibility.highContrast} />
              <Toggle checked={preferences.reduceAnimations} onChange={(value) => setPreference("reduceAnimations", value)} label={labels.accessibility.reduceAnimations} />
            </div>
            <Button onClick={savePreferences} disabled={isPending || preferencesSaving} className="mt-4 w-full gap-2 sm:w-auto">
              <Save size={17} />
              {isPending || preferencesSaving ? labels.saving : labels.save}
            </Button>
          </SectionCard>

          <SectionCard id="about" title={labels.sections.about} icon={Info} visible={selectedSection === "about"}>
            <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
              <AboutRow icon={Info} label={labels.about.version} value="1.0.0" />
              <AboutLink icon={Shield} label={labels.about.privacy} href="/privacy" />
              <AboutLink icon={Info} label={labels.about.terms} href="/terms" />
              <AboutLink icon={Heart} label={labels.about.guidelines} href="/terms" />
              <AboutLink icon={HelpCircle} label={labels.about.help} href="/data-deletion" />
              <a href="mailto:support@indb.community" className="flex min-h-13 items-center justify-between gap-3 px-4 py-3 text-sm font-bold hover:bg-muted/60">
                <span className="inline-flex items-center gap-3"><Phone size={18} className="text-primary" />{labels.about.contact}</span>
                <ChevronRight size={17} className={cn(isRtl && "rotate-180")} />
              </a>
              <AboutLink icon={Info} label={labels.about.about} href="/" />
            </div>
          </SectionCard>

          <SectionCard id="actions" title={labels.sections.actions} icon={AlertTriangle} visible={selectedSection === "actions"}>
            <div className="space-y-3">
              <form action={signOutAction}>
                <input type="hidden" name="locale" value={locale} />
                <Button type="submit" variant="outline" className="w-full gap-2 sm:w-auto">
                  <LogOut size={17} />
                  {labels.actions.logout}
                </Button>
              </form>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                <Button variant="outline" onClick={deactivate} disabled={isPending} className="w-full gap-2 border-amber-500/30 sm:w-auto">
                  <EyeOff size={17} />
                  {labels.actions.deactivate}
                </Button>
              </div>
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm font-bold text-destructive">{labels.actions.delete}</p>
                <p className="mt-1 text-xs text-muted-foreground">{labels.actions.deleteHint}</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={deleteConfirmation}
                    onChange={(event) => setDeleteConfirmation(event.target.value)}
                    placeholder={labels.actions.confirmation}
                    className="bg-card"
                  />
                  <Button variant="destructive" onClick={deleteAccount} disabled={isPending || deleteConfirmation.toUpperCase() !== "DELETE"} className="gap-2">
                    <Trash2 size={17} />
                    {labels.actions.delete}
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>
        </main>
      </div>
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{size?: number; className?: string}>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
      <Icon size={19} className="text-primary" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-black">{value}</p>
      </div>
    </div>
  );
}

function AboutRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{size?: number; className?: string}>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-13 items-center justify-between gap-3 px-4 py-3 text-sm font-bold">
      <span className="inline-flex items-center gap-3"><Icon size={18} className="text-primary" />{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

function AboutLink({
  icon: Icon,
  label,
  href,
}: {
  icon: ComponentType<{size?: number; className?: string}>;
  label: string;
  href: string;
}) {
  return (
    <Link href={href as never} className="flex min-h-13 items-center justify-between gap-3 px-4 py-3 text-sm font-bold hover:bg-muted/60">
      <span className="inline-flex items-center gap-3"><Icon size={18} className="text-primary" />{label}</span>
      <ChevronRight size={17} />
    </Link>
  );
}
