import { Fragment, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/translations";

// Short in-product legal strings (consent notices, banner, footer labels,
// data export). Kept in the legal feature rather than the app-wide
// translations file so all legal copy lives in one place. Templates use
// {token} placeholders filled with links by `fill()`.

export type LegalUi = {
  signupNotice: string; // tokens: {terms} {privacy} {age}
  termsLink: string;
  privacyLink: string;
  bookingNotice: string; // tokens: {terms} {business} {privacy}
  bannerTitle: string;
  bannerBody: string; // tokens: {terms} {privacy}
  bannerAccept: string;
  bannerError: string;
  report: string;
  footerImprint: string;
  footerAcceptableUse: string;
  footerDpa: string;
  footerReport: string;
  footerVat: string;
  exportTitle: string;
  exportDesc: string;
  exportButton: string;
  exportError: string;
  deleteConsequences: string;
  supportTitle: string;
  supportDesc: string;
  supportGrant: string;
  supportRevoke: string;
  supportActiveUntil: string; // tokens: {date}
  supportError: string;
};

const en: LegalUi = {
  signupNotice:
    "By continuing you agree to the {terms} and acknowledge the {privacy}. You confirm you are at least {age} years old.",
  termsLink: "Terms of Service",
  privacyLink: "Privacy Policy",
  bookingNotice:
    "By booking you agree to the {terms}. {business} receives your details to manage this booking and is responsible for them. Nandzz processes them on its behalf. See the {privacy}.",
  bannerTitle: "We've updated our Terms",
  bannerBody: "Please review the updated {terms} and {privacy}. Accept to keep using Nandzz.",
  bannerAccept: "Accept",
  bannerError: "Couldn't save. Please try again.",
  report: "Report",
  footerImprint: "Legal notice",
  footerAcceptableUse: "Acceptable Use",
  footerDpa: "Data Processing Agreement",
  footerReport: "Report content",
  footerVat: "VAT",
  exportTitle: "Download your data",
  exportDesc: "Get a copy of your account data, content, bookings and billing history as a JSON file.",
  exportButton: "Download my data",
  exportError: "Export failed. Please try again.",
  deleteConsequences:
    "Any active subscription is cancelled immediately and unused credits are lost. Download your data first if you want a copy.",
  supportTitle: "Support access",
  supportDesc: "Let the Nandzz team edit your profile, content and booking setup for 7 days to help you configure your account. Every change is logged and you can revoke access at any time.",
  supportGrant: "Allow for 7 days",
  supportRevoke: "Revoke access",
  supportActiveUntil: "Access active until {date}",
  supportError: "Couldn't save. Please try again.",
};

const it: LegalUi = {
  signupNotice:
    "Continuando accetti i {terms} e prendi visione dell'{privacy}. Confermi di avere almeno {age} anni.",
  termsLink: "Termini di Servizio",
  privacyLink: "Informativa privacy",
  bookingNotice:
    "Prenotando accetti i {terms}. {business} riceve i tuoi dati per gestire questa prenotazione e ne è titolare. Nandzz li tratta per suo conto. Vedi l'{privacy}.",
  bannerTitle: "Abbiamo aggiornato i Termini",
  bannerBody: "Leggi i {terms} e l'{privacy} aggiornati. Accetta per continuare a usare Nandzz.",
  bannerAccept: "Accetta",
  bannerError: "Salvataggio non riuscito. Riprova.",
  report: "Segnala",
  footerImprint: "Note legali",
  footerAcceptableUse: "Uso accettabile",
  footerDpa: "Accordo trattamento dati",
  footerReport: "Segnala contenuti",
  footerVat: "P.IVA",
  exportTitle: "Scarica i tuoi dati",
  exportDesc: "Ottieni una copia di dati dell'account, contenuti, prenotazioni e storico di fatturazione in formato JSON.",
  exportButton: "Scarica i miei dati",
  exportError: "Esportazione non riuscita. Riprova.",
  deleteConsequences:
    "Eventuali abbonamenti attivi vengono annullati subito e i crediti non usati vanno persi. Se vuoi una copia, scarica prima i tuoi dati.",
  supportTitle: "Accesso assistenza",
  supportDesc: "Consenti al team Nandzz di modificare profilo, contenuti e prenotazioni per 7 giorni per aiutarti a configurare l'account. Ogni modifica viene registrata e puoi revocare l'accesso in qualsiasi momento.",
  supportGrant: "Consenti per 7 giorni",
  supportRevoke: "Revoca accesso",
  supportActiveUntil: "Accesso attivo fino al {date}",
  supportError: "Salvataggio non riuscito. Riprova.",
};

const pt: LegalUi = {
  signupNotice:
    "Ao continuar, você aceita os {terms} e reconhece a {privacy}. Você confirma ter pelo menos {age} anos.",
  termsLink: "Termos de Serviço",
  privacyLink: "Política de Privacidade",
  bookingNotice:
    "Ao reservar, você aceita os {terms}. {business} recebe seus dados para gerenciar esta reserva e é responsável por eles. A Nandzz os processa em nome dela. Veja a {privacy}.",
  bannerTitle: "Atualizamos nossos Termos",
  bannerBody: "Leia os {terms} e a {privacy} atualizados. Aceite para continuar usando a Nandzz.",
  bannerAccept: "Aceitar",
  bannerError: "Não foi possível salvar. Tente novamente.",
  report: "Denunciar",
  footerImprint: "Aviso legal",
  footerAcceptableUse: "Uso aceitável",
  footerDpa: "Acordo de tratamento de dados",
  footerReport: "Denunciar conteúdo",
  footerVat: "IVA",
  exportTitle: "Baixar seus dados",
  exportDesc: "Obtenha uma cópia dos dados da conta, conteúdos, reservas e histórico de cobrança em JSON.",
  exportButton: "Baixar meus dados",
  exportError: "Falha na exportação. Tente novamente.",
  deleteConsequences:
    "Qualquer assinatura ativa é cancelada imediatamente e os créditos não usados são perdidos. Baixe seus dados antes, se quiser uma cópia.",
  supportTitle: "Acesso do suporte",
  supportDesc: "Permita que a equipe Nandzz edite seu perfil, conteúdos e agendamentos por 7 dias para ajudar a configurar sua conta. Toda alteração é registrada e você pode revogar o acesso a qualquer momento.",
  supportGrant: "Permitir por 7 dias",
  supportRevoke: "Revogar acesso",
  supportActiveUntil: "Acesso ativo até {date}",
  supportError: "Não foi possível salvar. Tente novamente.",
};

const fr: LegalUi = {
  signupNotice:
    "En continuant, vous acceptez les {terms} et prenez connaissance de la {privacy}. Vous confirmez avoir au moins {age} ans.",
  termsLink: "Conditions d'utilisation",
  privacyLink: "Politique de confidentialité",
  bookingNotice:
    "En réservant, vous acceptez les {terms}. {business} reçoit vos données pour gérer cette réservation et en est responsable. Nandzz les traite pour son compte. Voir la {privacy}.",
  bannerTitle: "Nous avons mis à jour nos Conditions",
  bannerBody: "Consultez les {terms} et la {privacy} mises à jour. Acceptez pour continuer à utiliser Nandzz.",
  bannerAccept: "Accepter",
  bannerError: "Enregistrement impossible. Réessayez.",
  report: "Signaler",
  footerImprint: "Mentions légales",
  footerAcceptableUse: "Utilisation acceptable",
  footerDpa: "Accord de traitement des données",
  footerReport: "Signaler un contenu",
  footerVat: "TVA",
  exportTitle: "Télécharger vos données",
  exportDesc: "Obtenez une copie des données du compte, contenus, réservations et historique de facturation au format JSON.",
  exportButton: "Télécharger mes données",
  exportError: "L'export a échoué. Réessayez.",
  deleteConsequences:
    "Tout abonnement actif est annulé immédiatement et les crédits non utilisés sont perdus. Téléchargez d'abord vos données si vous en voulez une copie.",
  supportTitle: "Accès support",
  supportDesc: "Autorisez l'équipe Nandzz à modifier votre profil, vos contenus et vos réservations pendant 7 jours pour vous aider à configurer votre compte. Chaque modification est journalisée et vous pouvez révoquer l'accès à tout moment.",
  supportGrant: "Autoriser 7 jours",
  supportRevoke: "Révoquer l'accès",
  supportActiveUntil: "Accès actif jusqu'au {date}",
  supportError: "Échec de l'enregistrement. Réessayez.",
};

const es: LegalUi = {
  signupNotice:
    "Al continuar aceptas los {terms} y reconoces la {privacy}. Confirmas que tienes al menos {age} años.",
  termsLink: "Términos de Servicio",
  privacyLink: "Política de Privacidad",
  bookingNotice:
    "Al reservar, aceptas los {terms}. {business} recibe tus datos para gestionar esta reserva y es responsable de ellos. Nandzz los trata en su nombre. Consulta la {privacy}.",
  bannerTitle: "Hemos actualizado nuestros Términos",
  bannerBody: "Revisa los {terms} y la {privacy} actualizados. Acepta para seguir usando Nandzz.",
  bannerAccept: "Aceptar",
  bannerError: "No se pudo guardar. Inténtalo de nuevo.",
  report: "Denunciar",
  footerImprint: "Aviso legal",
  footerAcceptableUse: "Uso aceptable",
  footerDpa: "Acuerdo de tratamiento de datos",
  footerReport: "Denunciar contenido",
  footerVat: "IVA",
  exportTitle: "Descargar tus datos",
  exportDesc: "Obtén una copia de los datos de la cuenta, contenidos, reservas e historial de facturación en JSON.",
  exportButton: "Descargar mis datos",
  exportError: "La exportación falló. Inténtalo de nuevo.",
  deleteConsequences:
    "Cualquier suscripción activa se cancela de inmediato y los créditos no usados se pierden. Descarga tus datos antes si quieres una copia.",
  supportTitle: "Acceso de soporte",
  supportDesc: "Permite que el equipo de Nandzz edite tu perfil, contenidos y reservas durante 7 días para ayudarte a configurar tu cuenta. Cada cambio queda registrado y puedes revocar el acceso en cualquier momento.",
  supportGrant: "Permitir 7 días",
  supportRevoke: "Revocar acceso",
  supportActiveUntil: "Acceso activo hasta el {date}",
  supportError: "No se pudo guardar. Inténtalo de nuevo.",
};

const de: LegalUi = {
  signupNotice:
    "Mit dem Fortfahren akzeptierst du die {terms} und nimmst die {privacy} zur Kenntnis. Du bestätigst, mindestens {age} Jahre alt zu sein.",
  termsLink: "Nutzungsbedingungen",
  privacyLink: "Datenschutzerklärung",
  bookingNotice:
    "Mit der Buchung akzeptierst du die {terms}. {business} erhält deine Daten zur Verwaltung dieser Buchung und ist dafür verantwortlich. Nandzz verarbeitet sie in deren Auftrag. Siehe {privacy}.",
  bannerTitle: "Wir haben unsere Bedingungen aktualisiert",
  bannerBody: "Bitte lies die aktualisierten {terms} und die {privacy}. Akzeptiere, um Nandzz weiter zu nutzen.",
  bannerAccept: "Akzeptieren",
  bannerError: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
  report: "Melden",
  footerImprint: "Impressum",
  footerAcceptableUse: "Nutzungsrichtlinie",
  footerDpa: "Auftragsverarbeitungsvertrag",
  footerReport: "Inhalt melden",
  footerVat: "USt-IdNr.",
  exportTitle: "Deine Daten herunterladen",
  exportDesc: "Erhalte eine Kopie deiner Kontodaten, Inhalte, Buchungen und Abrechnungshistorie als JSON-Datei.",
  exportButton: "Meine Daten herunterladen",
  exportError: "Export fehlgeschlagen. Bitte erneut versuchen.",
  deleteConsequences:
    "Aktive Abonnements werden sofort gekündigt und ungenutzte Credits verfallen. Lade vorher deine Daten herunter, wenn du eine Kopie möchtest.",
  supportTitle: "Support-Zugriff",
  supportDesc: "Erlaube dem Nandzz-Team, dein Profil, deine Inhalte und Buchungen 7 Tage lang zu bearbeiten, um dein Konto einzurichten. Jede Änderung wird protokolliert und du kannst den Zugriff jederzeit widerrufen.",
  supportGrant: "7 Tage erlauben",
  supportRevoke: "Zugriff widerrufen",
  supportActiveUntil: "Zugriff aktiv bis {date}",
  supportError: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
};

const ja: LegalUi = {
  signupNotice: "続行すると、{terms}に同意し、{privacy}を確認したものとみなされます。{age}歳以上であることを確認します。",
  termsLink: "利用規約",
  privacyLink: "プライバシーポリシー",
  bookingNotice:
    "予約することで{terms}に同意したものとみなされます。{business}がこの予約を管理するためにあなたの情報を受け取り、その管理責任を負います。Nandzzは同社に代わって処理します（{privacy}参照）。",
  bannerTitle: "利用規約を更新しました",
  bannerBody: "更新された{terms}と{privacy}をご確認ください。Nandzzを引き続き利用するには同意してください。",
  bannerAccept: "同意する",
  bannerError: "保存できませんでした。もう一度お試しください。",
  report: "報告",
  footerImprint: "法的情報",
  footerAcceptableUse: "利用ポリシー",
  footerDpa: "データ処理契約",
  footerReport: "コンテンツを報告",
  footerVat: "VAT",
  exportTitle: "データをダウンロード",
  exportDesc: "アカウント情報、コンテンツ、予約、請求履歴のコピーをJSONファイルで取得できます。",
  exportButton: "データをダウンロード",
  exportError: "エクスポートに失敗しました。もう一度お試しください。",
  deleteConsequences:
    "有効なサブスクリプションは直ちに解約され、未使用のクレジットは失われます。コピーが必要な場合は先にデータをダウンロードしてください。",
  supportTitle: "サポートアクセス",
  supportDesc: "アカウント設定をお手伝いするため、Nandzzチームが7日間プロフィール・コンテンツ・予約設定を編集できるようにします。すべての変更は記録され、いつでもアクセスを取り消せます。",
  supportGrant: "7日間許可する",
  supportRevoke: "アクセスを取り消す",
  supportActiveUntil: "{date}までアクセス有効",
  supportError: "保存できませんでした。もう一度お試しください。",
};

const UI: Record<Locale, LegalUi> = { en, it, pt, fr, es, de, ja };

export function getLegalUi(locale: Locale): LegalUi {
  return UI[locale] ?? en;
}

// Replaces {token} placeholders with React nodes (links, names).
export function fill(template: string, values: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{[a-z]+\})/g).map((part, i) => {
    const m = /^\{([a-z]+)\}$/.exec(part);
    return <Fragment key={i}>{m && m[1] in values ? values[m[1]] : part}</Fragment>;
  });
}
