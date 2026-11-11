/**
 * Shared UI pack for auth, chatbots, AI cockpit, toasts and API errors.
 * French is the source language; other locales are first-class, not afterthoughts.
 */

const LANGS = ["fr", "en", "es", "de", "it", "ar"];

function row(fr, en, es, de, it, ar) {
  return { fr, en, es, de, it, ar };
}

function fromRows(rows) {
  const APP_UI = Object.fromEntries(LANGS.map((l) => [l, {}]));
  const PHRASE_INDEX = {};
  for (const [key, val] of Object.entries(rows)) {
    for (const l of LANGS) APP_UI[l][key] = val[l];
    if (typeof val.fr === "string" && val.fr.trim() && val.en) {
      PHRASE_INDEX[val.fr] = { en: val.en, es: val.es, de: val.de, it: val.it, ar: val.ar };
    }
  }
  return { APP_UI, PHRASE_INDEX };
}

const ROWS = {
  // —— Auth chrome ——
  authHome: row("Accueil", "Home", "Inicio", "Startseite", "Home", "الرئيسية"),
  authBackHome: row("Retour à l'accueil", "Back to home", "Volver al inicio", "Zurück zur Startseite", "Torna alla home", "العودة إلى الرئيسية"),
  authLiveSync: row("Synchronisation en direct", "Live sync", "Sincronización en vivo", "Live-Synchronisierung", "Sincronizzazione live", "مزامنة مباشرة"),
  authHeroTitle1: row("Pilotez votre inventaire", "Run your inventory", "Pilote su inventario", "Steuern Sie Ihr Inventar", "Pilota il tuo inventario", "أدِر مخزونك"),
  authHeroTitle2: row("en temps réel, sans effort.", "in real time, without friction.", "en tiempo real, sin esfuerzo.", "in Echtzeit, ohne Aufwand.", "in tempo reale, senza sforzo.", "في الوقت الفعلي، دون عناء."),
  authHeroText: row(
    "Suivi des entrées, sorties et alertes de réapprovisionnement sur une seule plateforme.",
    "Track inbound, outbound and replenishment alerts on a single platform.",
    "Siga entradas, salidas y alertas de reposición en una sola plataforma.",
    "Eingänge, Ausgänge und Nachschubalarme auf einer Plattform.",
    "Entrate, uscite e alert di rifornimento su un'unica piattaforma.",
    "تتبّع الإدخالات والإخراجات وتنبيهات التموين على منصة واحدة."
  ),
  authStatArticles: row("Articles gérés", "Items managed", "Artículos gestionados", "Verwaltete Artikel", "Articoli gestiti", "مواد مُدارة"),
  authStatDepots: row("Dépôts connectés", "Warehouses connected", "Almacenes conectados", "Verbundene Lager", "Depositi collegati", "مستودعات متصلة"),
  authStatAi: row("Précision IA", "AI accuracy", "Precisión IA", "KI-Genauigkeit", "Precisione IA", "دقة الذكاء الاصطناعي"),
  authEncrypt: row("Chiffrement de bout en bout · RGPD", "End-to-end encryption · GDPR", "Cifrado de extremo a extremo · RGPD", "Ende-zu-Ende-Verschlüsselung · DSGVO", "Cifratura end-to-end · GDPR", "تشفير من طرف إلى طرف · اللائحة العامة"),
  authTeams: row("· 2 400+ équipes", "· 2,400+ teams", "· 2 400+ equipos", "· 2.400+ Teams", "· 2.400+ team", "· أكثر من 2400 فريق"),
  authPlatform: row("Plateforme de gestion de stock", "Inventory management platform", "Plataforma de gestión de stock", "Bestandsmanagement-Plattform", "Piattaforma di gestione stock", "منصة إدارة المخزون"),
  authLogin: row("Connexion", "Sign in", "Iniciar sesión", "Anmelden", "Accedi", "تسجيل الدخول"),
  authSignup: row("Inscription", "Sign up", "Registro", "Registrierung", "Registrazione", "إنشاء حساب"),
  authEmail: row("Adresse e-mail", "Email address", "Correo electrónico", "E-Mail-Adresse", "Indirizzo email", "البريد الإلكتروني"),
  authPassword: row("Mot de passe", "Password", "Contraseña", "Passwort", "Password", "كلمة المرور"),
  authEmailPh: row("vous@entreprise.com", "you@company.com", "usted@empresa.com", "sie@firma.de", "voi@azienda.com", "you@company.com"),
  authForgotTitle: row("Mot de passe oublié", "Forgot password", "Contraseña olvidada", "Passwort vergessen", "Password dimenticata", "نسيت كلمة المرور"),
  authForgotSent: row(
    "Consultez votre boîte mail. Le lien expire dans 1 heure.",
    "Check your inbox. The link expires in 1 hour.",
    "Revise su bandeja. El enlace caduca en 1 hora.",
    "Prüfen Sie Ihr Postfach. Der Link läuft in 1 Stunde ab.",
    "Controllate la casella. Il link scade tra 1 ora.",
    "راجع بريدك. ينتهي الرابط خلال ساعة."
  ),
  authForgotAsk: row(
    "Entrez votre adresse e-mail pour recevoir un lien de réinitialisation.",
    "Enter your email to receive a reset link.",
    "Introduzca su correo para recibir un enlace de restablecimiento.",
    "Geben Sie Ihre E-Mail ein, um einen Reset-Link zu erhalten.",
    "Inserite l'email per ricevere un link di reimpostazione.",
    "أدخل بريدك لتلقي رابط إعادة التعيين."
  ),
  authSendLink: row("Envoyer le lien", "Send link", "Enviar enlace", "Link senden", "Invia link", "إرسال الرابط"),
  authSending: row("Envoi…", "Sending…", "Enviando…", "Senden…", "Invio…", "جاري الإرسال…"),
  authBackLogin: row("Retour à la connexion", "Back to sign in", "Volver al inicio de sesión", "Zurück zur Anmeldung", "Torna all'accesso", "العودة لتسجيل الدخول"),
  authResetInvalid: row("Lien invalide", "Invalid link", "Enlace no válido", "Ungültiger Link", "Link non valido", "رابط غير صالح"),
  authResetInvalidText: row(
    "Ce lien de réinitialisation est incomplet ou a expiré.",
    "This reset link is incomplete or has expired.",
    "Este enlace de restablecimiento está incompleto o ha caducado.",
    "Dieser Reset-Link ist unvollständig oder abgelaufen.",
    "Questo link di reimpostazione è incompleto o scaduto.",
    "رابط إعادة التعيين ناقص أو منتهٍ."
  ),
  authResetDone: row("Mot de passe mis à jour", "Password updated", "Contraseña actualizada", "Passwort aktualisiert", "Password aggiornata", "تم تحديث كلمة المرور"),
  authResetDoneText: row(
    "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.",
    "You can now sign in with your new password.",
    "Ya puede iniciar sesión con su nueva contraseña.",
    "Sie können sich jetzt mit dem neuen Passwort anmelden.",
    "Potete accedere con la nuova password.",
    "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة."
  ),
  authResetTitle: row("Nouveau mot de passe", "New password", "Nueva contraseña", "Neues Passwort", "Nuova password", "كلمة مرور جديدة"),
  authResetHint: row(
    "Choisissez un mot de passe sécurisé pour votre compte Stokify.",
    "Choose a strong password for your Stokify account.",
    "Elija una contraseña segura para su cuenta Stokify.",
    "Wählen Sie ein sicheres Passwort für Ihr Stokify-Konto.",
    "Scegliete una password sicura per l'account Stokify.",
    "اختر كلمة مرور قوية لحساب ستوكيفاي."
  ),
  authNewPassword: row("Nouveau mot de passe", "New password", "Nueva contraseña", "Neues Passwort", "Nuova password", "كلمة مرور جديدة"),
  authConfirmPassword: row("Confirmer le mot de passe", "Confirm password", "Confirmar contraseña", "Passwort bestätigen", "Conferma password", "تأكيد كلمة المرور"),
  authPwdMismatch: row("Les mots de passe ne correspondent pas", "Passwords do not match", "Las contraseñas no coinciden", "Passwörter stimmen nicht überein", "Le password non coincidono", "كلمتا المرور غير متطابقتين"),
  authResetSubmit: row("Réinitialiser le mot de passe", "Reset password", "Restablecer contraseña", "Passwort zurücksetzen", "Reimposta password", "إعادة تعيين كلمة المرور"),
  authSaving: row("Enregistrement…", "Saving…", "Guardando…", "Speichern…", "Salvataggio…", "جاري الحفظ…"),
  authWelcomeBack: row("Bon retour parmi vous", "Welcome back", "Bienvenido de nuevo", "Willkommen zurück", "Bentornati", "مرحباً بعودتك"),
  authWelcomeSub: row(
    "Accédez à votre tableau de bord de gestion de stock.",
    "Open your inventory command dashboard.",
    "Acceda a su panel de gestión de stock.",
    "Öffnen Sie Ihr Bestands-Dashboard.",
    "Aprite la dashboard di gestione stock.",
    "ادخل إلى لوحة قيادة المخزون."
  ),
  authRemember: row("Se souvenir de moi", "Remember me", "Recordarme", "Angemeldet bleiben", "Ricordami", "تذكّرني"),
  authForgot: row("Mot de passe oublié ?", "Forgot password?", "¿Olvidó su contraseña?", "Passwort vergessen?", "Password dimenticata?", "نسيت كلمة المرور؟"),
  authSignIn: row("Se connecter", "Sign in", "Iniciar sesión", "Anmelden", "Accedi", "تسجيل الدخول"),
  authSigningIn: row("Connexion…", "Signing in…", "Conectando…", "Anmeldung…", "Accesso…", "جاري الدخول…"),
  authLocked: row("Compte verrouillé", "Account locked", "Cuenta bloqueada", "Konto gesperrt", "Account bloccato", "الحساب مقفل"),
  authUnlockIn: row("Déblocage automatique dans {n}s", "Automatic unlock in {n}s", "Desbloqueo automático en {n}s", "Automatische Entsperrung in {n}s", "Sblocco automatico tra {n}s", "إلغاء القفل تلقائياً خلال {n} ث"),
  authLockRetry: row(
    "Compte temporairement verrouillé, réessayez dans {n} minute{s}",
    "Account temporarily locked, try again in {n} minute{s}",
    "Cuenta bloqueada temporalmente, reintente en {n} minuto{s}",
    "Konto vorübergehend gesperrt, erneut in {n} Minute{s}",
    "Account temporaneamente bloccato, riprovare tra {n} minut{s}",
    "الحساب مقفل مؤقتاً، أعد المحاولة خلال {n} دقيقة"
  ),
  authOrgTitle: row(
    "Accès réservé à votre organisation",
    "Access reserved for your organization",
    "Acceso reservado a su organización",
    "Zugang für Ihre Organisation",
    "Accesso riservato alla vostra organizzazione",
    "الوصول مخصص لمؤسستك"
  ),
  authOrgText: row(
    "Utilisez l'adresse professionnelle de votre société. Un administrateur active le compte avant le premier accès.",
    "Use your company email address. An administrator activates the account before the first sign-in.",
    "Use el correo profesional de su empresa. Un administrador activa la cuenta antes del primer acceso.",
    "Nutzen Sie die geschäftliche E-Mail Ihres Unternehmens. Ein Administrator aktiviert das Konto vor der ersten Anmeldung.",
    "Usate l'email professionale della vostra azienda. Un amministratore attiva l'account prima del primo accesso.",
    "استخدموا البريد المهني لشركتكم. يفعّل المسؤول الحساب قبل أول دخول."
  ),
  authSecure: row("Connexion sécurisée · Vos données sont chiffrées", "Secure sign-in · Your data is encrypted", "Acceso seguro · Sus datos están cifrados", "Sichere Anmeldung · Ihre Daten sind verschlüsselt", "Accesso sicuro · I dati sono cifrati", "دخول آمن · بياناتك مشفّرة"),
  authWeak: row("Faible", "Weak", "Débil", "Schwach", "Debole", "ضعيفة"),
  authMedium: row("Moyen", "Fair", "Media", "Mittel", "Media", "متوسطة"),
  authGood: row("Bon", "Good", "Buena", "Gut", "Buona", "جيدة"),
  authExcellent: row("Excellent", "Excellent", "Excelente", "Ausgezeichnet", "Eccellente", "ممتازة"),
  authShowPwd: row("Afficher le mot de passe", "Show password", "Mostrar contraseña", "Passwort anzeigen", "Mostra password", "إظهار كلمة المرور"),
  authHidePwd: row("Masquer le mot de passe", "Hide password", "Ocultar contraseña", "Passwort verbergen", "Nascondi password", "إخفاء كلمة المرور"),
  authAccountCreated: row("Compte créé", "Account created", "Cuenta creada", "Konto erstellt", "Account creato", "تم إنشاء الحساب"),
  authPending1: row("Votre inscription a bien été enregistrée. Elle est", "Your registration has been saved. It is", "Su registro se ha guardado. Está", "Ihre Registrierung wurde gespeichert. Sie ist", "La registrazione è stata salvata. È", "تم حفظ تسجيلك. وهو"),
  authPendingHighlight: row("en attente de validation par un administrateur", "pending admin approval", "pendiente de validación por un administrador", "wartet auf Freigabe durch einen Administrator", "in attesa di convalida da un amministratore", "بانتظار موافقة المسؤول"),
  authPending2: row(
    ". Vous pourrez vous connecter dès que votre compte sera activé.",
    ". You can sign in as soon as your account is activated.",
    ". Podrá iniciar sesión cuando se active su cuenta.",
    ". Sie können sich anmelden, sobald das Konto aktiviert ist.",
    ". Potrete accedere non appena l'account sarà attivato.",
    ". يمكنك تسجيل الدخول فور تفعيل الحساب."
  ),
  authPendingAdmin: row(
    "Un administrateur de la société traitera votre demande sous peu. Aucune action supplémentaire n’est requise de votre côté.",
    "A company administrator will review your request shortly. No further action is required.",
    "Un administrador de la empresa tratará su solicitud en breve. No se requiere ninguna otra acción.",
    "Ein Administrator der Firma prüft Ihre Anfrage in Kürze. Es ist nichts weiter zu tun.",
    "Un amministratore dell'azienda esaminerà la richiesta a breve. Nessun'altra azione è richiesta.",
    "سيراجع مسؤول الشركة طلبك قريباً. لا يلزم أي إجراء إضافي."
  ),
  authRegisterTitle: row("Créez votre espace Stokify", "Create your Stokify workspace", "Cree su espacio Stokify", "Erstellen Sie Ihren Stokify-Bereich", "Create il vostro spazio Stokify", "أنشئ مساحة ستوكيفاي"),
  authRegisterSub: row(
    "Le compte est rattaché à une société et activé par un administrateur.",
    "The account is tied to a company and activated by an administrator.",
    "La cuenta queda vinculada a una empresa y la activa un administrador.",
    "Das Konto ist einem Unternehmen zugeordnet und wird von einem Administrator aktiviert.",
    "L'account è collegato a un'azienda e attivato da un amministratore.",
    "يُربط الحساب بشركة ويفعّله مسؤول."
  ),
  authFirstName: row("Prénom", "First name", "Nombre", "Vorname", "Nome", "الاسم"),
  authLastName: row("Nom", "Last name", "Apellido", "Nachname", "Cognome", "اللقب"),
  authRole: row("Rôle", "Role", "Rol", "Rolle", "Ruolo", "الدور"),
  authCompany: row("Société", "Company", "Empresa", "Unternehmen", "Azienda", "الشركة"),
  authAcceptTerms: row("J'accepte les", "I accept the", "Acepto los", "Ich akzeptiere die", "Accetto i", "أوافق على"),
  authTerms: row("conditions d'utilisation", "terms of use", "términos de uso", "Nutzungsbedingungen", "termini di utilizzo", "شروط الاستخدام"),
  authAndPrivacy: row("et la politique de confidentialité", "and the privacy policy", "y la política de privacidad", "und die Datenschutzrichtlinie", "e l'informativa sulla privacy", "وسياسة الخصوصية"),
  authCreateAccount: row("Créer mon compte", "Create my account", "Crear mi cuenta", "Konto erstellen", "Crea il mio account", "إنشاء حسابي"),
  authCreating: row("Création…", "Creating…", "Creando…", "Erstellen…", "Creazione…", "جاري الإنشاء…"),
  authRoleMagasinier: row("Magasinier", "Warehouse clerk", "Almacenero", "Lagerist", "Magazziniere", "أمين مخزن"),
  authRoleResponsable: row("Responsable logistique", "Logistics manager", "Responsable de logística", "Logistikverantwortliche/r", "Responsabile logistica", "مسؤول لوجستي"),
  authRoleComptable: row("Comptable", "Accountant", "Contable", "Buchhalter/in", "Contabile", "محاسب"),
  authRoleClient: row("Client", "Customer", "Cliente", "Kunde", "Cliente", "عميل"),
  authNoAccount: row("Pas encore de compte ?", "No account yet?", "¿Aún no tiene cuenta?", "Noch kein Konto?", "Non avete un account?", "ليس لديك حساب؟"),
  authSignupFree: row("Demander un accès", "Request access", "Solicitar acceso", "Zugang anfordern", "Richiedere l'accesso", "طلب الوصول"),
  authHasAccount: row("Déjà inscrit ?", "Already registered?", "¿Ya está registrado?", "Bereits registriert?", "Già registrato?", "مسجّل مسبقاً؟"),
  authCameraTitle: row("Vérification de sécurité", "Security check", "Verificación de seguridad", "Sicherheitsprüfung", "Verifica di sicurezza", "تحقق أمني"),
  authCameraText: row(
    "Pour des raisons de sécurité, nous vous demandons l'accès à votre caméra afin de vérifier votre identité. Cette étape est optionnelle.",
    "For security, we ask camera access to verify your identity. This step is optional.",
    "Por seguridad, solicitamos acceso a la cámara para verificar su identidad. Este paso es opcional.",
    "Aus Sicherheitsgründen bitten wir um Kamerazugriff zur Identitätsprüfung. Dieser Schritt ist optional.",
    "Per sicurezza chiediamo l'accesso alla fotocamera per verificare l'identità. Questo passaggio è facoltativo.",
    "لأسباب أمنية نطلب الوصول إلى الكاميرا للتحقق من هويتك. هذه الخطوة اختيارية."
  ),
  authAllow: row("Autoriser", "Allow", "Permitir", "Zulassen", "Consenti", "السماح"),
  authCapture: row("Capture…", "Capturing…", "Capturando…", "Aufnahme…", "Acquisizione…", "جاري الالتقاط…"),
  authSkipCamera: row("Continuer sans caméra", "Continue without camera", "Continuar sin cámara", "Ohne Kamera fortfahren", "Continua senza fotocamera", "المتابعة بدون كاميرا"),
  authInvalidServer: row("Réponse serveur invalide.", "Invalid server response.", "Respuesta del servidor no válida.", "Ungültige Serverantwort.", "Risposta del server non valida.", "استجابة خادم غير صالحة."),
  authRegisterFail: row("Échec de l'inscription", "Registration failed", "Error de registro", "Registrierung fehlgeschlagen", "Registrazione non riuscita", "فشل التسجيل"),
  authForgotToast: row(
    "Si un compte existe, un e-mail de réinitialisation a été envoyé.",
    "If an account exists, a reset email has been sent.",
    "Si existe una cuenta, se ha enviado un correo de restablecimiento.",
    "Falls ein Konto existiert, wurde eine Reset-E-Mail gesendet.",
    "Se l'account esiste, è stata inviata un'email di reimpostazione.",
    "إذا وُجد حساب، فقد أُرسل بريد إعادة التعيين."
  ),
  authForgotFail: row(
    "Impossible d'envoyer l'e-mail de réinitialisation",
    "Could not send the reset email",
    "No se pudo enviar el correo de restablecimiento",
    "Reset-E-Mail konnte nicht gesendet werden",
    "Impossibile inviare l'email di reimpostazione",
    "تعذّر إرسال بريد إعادة التعيين"
  ),
  authResetOkToast: row("Mot de passe réinitialisé avec succès", "Password reset successfully", "Contraseña restablecida con éxito", "Passwort erfolgreich zurückgesetzt", "Password reimpostata con successo", "تم إعادة تعيين كلمة المرور"),
  authLinkExpired: row("Lien invalide ou expiré", "Invalid or expired link", "Enlace no válido o caducado", "Ungültiger oder abgelaufener Link", "Link non valido o scaduto", "رابط غير صالح أو منتهٍ"),
  authBadCredentials: row("Identifiants incorrects", "Incorrect credentials", "Credenciales incorrectas", "Ungültige Anmeldedaten", "Credenziali non corrette", "بيانات اعتماد غير صحيحة"),
  authWelcomeToast: row("Bon retour, {name} — Connexion n°{n} · {date}", "Welcome back, {name} — Sign-in #{n} · {date}", "Bienvenido, {name} — Acceso n.º {n} · {date}", "Willkommen zurück, {name} — Anmeldung Nr. {n} · {date}", "Bentornato, {name} — Accesso n. {n} · {date}", "مرحباً بعودتك يا {name} — تسجيل الدخول رقم {n} · {date}"),
  authWelcomeFirstToast: row("Bon retour, {name} — Première connexion enregistrée.", "Welcome back, {name} — First sign-in recorded.", "Bienvenido, {name} — Primer acceso registrado.", "Willkommen zurück, {name} — Erste Anmeldung erfasst.", "Bentornato, {name} — Primo accesso registrato.", "مرحباً بعودتك يا {name} — سُجّل أول دخول."),

  // —— Chat chrome ——
  chatOnline: row("En ligne", "Online", "En línea", "Online", "Online", "متصل"),
  chatClose: row("Fermer", "Close", "Cerrar", "Schließen", "Chiudi", "إغلاق"),
  chatNew: row("Nouvelle conversation", "New conversation", "Nueva conversación", "Neue Unterhaltung", "Nuova conversazione", "محادثة جديدة"),
  chatSend: row("Envoyer", "Send", "Enviar", "Senden", "Invia", "إرسال"),
  chatSources: row("Sources", "Sources", "Fuentes", "Quellen", "Fonti", "المصادر"),
  chatOutOfScope: row("Hors périmètre magasin", "Outside warehouse scope", "Fuera del almacén", "Außerhalb des Lagerbereichs", "Fuori perimetro magazzino", "خارج نطاق المخزن"),
  chatDenied: row("accès", "access", "acceso", "Zugriff", "accesso", "وصول"),
  chatDown: row("indispo", "down", "caído", "offline", "non disp.", "غير متاح"),
  chatCloseAssistant: row("Fermer l'assistant", "Close assistant", "Cerrar el asistente", "Assistent schließen", "Chiudi assistente", "إغلاق المساعد"),
  stokiBadge: row("Copilote magasin", "Warehouse copilot", "Copiloto de almacén", "Lager-Copilot", "Copilota magazzino", "مساعد المخزن"),
  stokiBoot: row("Un instant — je prends le pouls du magasin…", "One moment — checking the warehouse pulse…", "Un momento — tomo el pulso del almacén…", "Einen Moment — ich prüfe den Lagerpuls…", "Un attimo — sto rilevando il polso del magazzino…", "لحظة — أتفقد نبض المخزن…"),
  stokiGreeting: row(
    "Bonjour{name}. **STOKI** est en ligne — agent métier Stokify.\n\n{pulse}\n\nPosez la question comme à un collègue magasin.",
    "Hello{name}. **STOKI** is online — Stokify's operations agent.\n\n{pulse}\n\nAsk as you would a warehouse colleague.",
    "Hola{name}. **STOKI** está en línea — agente operativo de Stokify.\n\n{pulse}\n\nPregunte como a un colega de almacén.",
    "Hallo{name}. **STOKI** ist online — Stokifys Betriebsagent.\n\n{pulse}\n\nFragen Sie wie einen Lagerkollegen.",
    "Buongiorno{name}. **STOKI** è online — agente operativo Stokify.\n\n{pulse}\n\nChiedete come a un collega di magazzino.",
    "مرحباً{name}. **STOKI** متصل — وكيل ستوكيفاي التشغيلي.\n\n{pulse}\n\nاسأل كما تسأل زميلاً في المخزن."
  ),
  stokiPulseCalm: row("Rayon calme : pas de rupture, pas de DLC chaude.", "Aisle calm: no stockouts, no hot expiry dates.", "Pasillo tranquilo: sin rupturas ni caducidades calientes.", "Gasse ruhig: keine Engpässe, keine heißen MHD.", "Corsia calma: niente rotture, niente scadenze calde.", "الممر هادئ: لا نفاد ولا تواريخ صلاحية حرجة."),
  stokiPulseRupture: row("**{n} rupture(s)** sur le radar{lots}.", "**{n} stockout(s)** on the radar{lots}.", "**{n} ruptura(s)** en el radar{lots}.", "**{n} Engpass/Engpässe** auf dem Radar{lots}.", "**{n} rottura/e** sul radar{lots}.", "**{n} نفاد** على الرادار{lots}."),
  stokiPulseLots: row("Pas de rupture. **{n} lot(s)** arrivent à DLC — FEFO avant qu'il ne soit trop tard.", "No stockouts. **{n} lot(s)** near expiry — FEFO before it is too late.", "Sin rupturas. **{n} lote(s)** cerca de caducar — FEFO antes de que sea tarde.", "Keine Engpässe. **{n} Los/Lose** laufen ab — FEFO, bevor es zu spät ist.", "Niente rotture. **{n} lotto/i** in scadenza — FEFO prima che sia tardi.", "لا نفاد. **{n} دفعة/دفعات** تقترب من الانتهاء — FEFO قبل فوات الأوان."),
  stokiLotsHint: row(" · {n} lot(s) < 30 j", " · {n} lot(s) < 30d", " · {n} lote(s) < 30 d", " · {n} Los/Lose < 30 T", " · {n} lotto/i < 30 g", " · {n} دفعة خلال 30 يوماً"),
  stokiError: row(
    "Je n'ai pas pu consulter Stokify pour le moment. Réessayez dans un instant — je reste sur les données magasin, sans inventer de chiffres.",
    "I could not reach Stokify just now. Try again in a moment — I stay on warehouse data and never invent figures.",
    "No pude consultar Stokify por ahora. Reintente en un instante — me mantengo en datos de almacén, sin inventar cifras.",
    "Stokify ist gerade nicht erreichbar. Versuchen Sie es gleich erneut — ich bleibe bei Lagerdaten und erfinde keine Zahlen.",
    "Non riesco a interrogare Stokify al momento. Riprovate tra un attimo — resto sui dati magazzino, senza inventare cifre.",
    "تعذّر الوصول إلى ستوكيفاي الآن. أعد المحاولة بعد لحظة — أبقى على بيانات المخزن دون اختراع أرقام."
  ),
  stokiFooter: row("Copilote magasin · données live · questions libres", "Warehouse copilot · live data · free-form questions", "Copiloto de almacén · datos en vivo · preguntas libres", "Lager-Copilot · Live-Daten · freie Fragen", "Copilota magazzino · dati live · domande libere", "مساعد المخزن · بيانات مباشرة · أسئلة حرّة"),
  stokiPlaceholder: row("Un article, un concept, un calcul…", "An item, a concept, a calculation…", "Un artículo, un concepto, un cálculo…", "Ein Artikel, ein Konzept, eine Berechnung…", "Un articolo, un concetto, un calcolo…", "مادة، مفهوم، حساب…"),
  stokiPlaceholderLimit: row("Démarrez une nouvelle conversation…", "Start a new conversation…", "Inicie una nueva conversación…", "Neue Unterhaltung starten…", "Avviate una nuova conversazione…", "ابدأ محادثة جديدة…"),
  stokiPistes: row("Pistes du jour", "Today's prompts", "Pistas del día", "Impulse des Tages", "Spunti del giorno", "اقتراحات اليوم"),
  stokiLongConv: row("Conversation longue — on repart sur une page blanche.", "Long thread — let's start on a blank page.", "Conversación larga — volvamos a una página en blanco.", "Langes Gespräch — wir beginnen auf einer leeren Seite.", "Conversazione lunga — ripartiamo da pagina bianca.", "محادثة طويلة — نبدأ صفحة بيضاء."),
  stokiOpen: row("Ouvrir l'assistant IA Stoki", "Open Stoki AI assistant", "Abrir el asistente IA Stoki", "Stoki-KI-Assistent öffnen", "Apri l'assistente IA Stoki", "فتح مساعد ستوكي"),
  stokiLoad0: row("Analyse de la question…", "Analysing the question…", "Analizando la pregunta…", "Frage wird analysiert…", "Analisi della domanda…", "تحليل السؤال…"),
  stokiLoad1: row("Sélection des outils métier…", "Selecting business tools…", "Seleccionando herramientas…", "Fachtools werden gewählt…", "Selezione degli strumenti…", "اختيار الأدوات المهنية…"),
  stokiLoad2: row("Analyse du stock…", "Analysing stock…", "Analizando el stock…", "Bestand wird analysiert…", "Analisi dello stock…", "تحليل المخزون…"),
  stokiLoad3: row("Consultation des prévisions…", "Checking forecasts…", "Consultando previsiones…", "Prognosen werden geprüft…", "Consultazione delle previsioni…", "مراجعة التوقعات…"),
  stokiLoad4: row("Vérification des anomalies…", "Checking anomalies…", "Comprobando anomalías…", "Anomalien werden geprüft…", "Verifica delle anomalie…", "التحقق من الشذوذات…"),
  stokiLoad5: row("Consultation des données live…", "Reading live data…", "Leyendo datos en vivo…", "Live-Daten werden gelesen…", "Lettura dei dati live…", "قراءة البيانات المباشرة…"),
  stokiSug1: row("Quels articles sont en rupture ?", "Which items are out of stock?", "¿Qué artículos están en ruptura?", "Welche Artikel sind ausverkauft?", "Quali articoli sono in rottura?", "ما المواد النافدة؟"),
  stokiSug2: row("Quels lots expirent bientôt ?", "Which lots expire soon?", "¿Qué lotes caducan pronto?", "Welche Lose laufen bald ab?", "Quali lotti scadono presto?", "ما الدفعات التي تنتهي قريباً؟"),
  stokiSug3: row("C'est quoi FEFO ?", "What is FEFO?", "¿Qué es FEFO?", "Was ist FEFO?", "Cos'è il FEFO?", "ما هو FEFO؟"),
  stokiSug4: row("Quels produits se vendent le plus ?", "Which products sell the most?", "¿Qué productos se venden más?", "Welche Produkte verkaufen sich am besten?", "Quali prodotti si vendono di più?", "ما أكثر المنتجات مبيعاً؟"),
  stokiSugRisk: row("Quels produits risquent une rupture et pourquoi ?", "Which products risk a stockout, and why?", "¿Qué productos arriesgan ruptura y por qué?", "Welche Produkte drohen auszugehen – und warum?", "Quali prodotti rischiano la rottura e perché?", "ما المنتجات المعرّضة للنفاد ولماذا؟"),
  stokiSugAnom: row("Analyse les anomalies en cours", "Analyse current anomalies", "Analiza las anomalías en curso", "Analysiere laufende Anomalien", "Analizza le anomalie in corso", "حلّل الشذوذات الجارية"),
  stokiStatusOk: row("Magasin sous contrôle", "Warehouse under control", "Almacén bajo control", "Lager unter Kontrolle", "Magazzino sotto controllo", "المخزن تحت السيطرة"),
  stokiStatusWatch: row("Vigilance DLC", "Expiry watch", "Vigilancia de caducidad", "MHD-Aufmerksamkeit", "Vigilanza scadenze", "مراقبة الصلاحية"),

  stellaBadge: row("Hôtesse B2B", "B2B host", "Anfitriona B2B", "B2B-Hostess", "Hostess B2B", "مضيفة أعمال"),
  stellaBoot: row("Un instant — je prépare le salon…", "One moment — preparing the lounge…", "Un momento — preparo el salón…", "Einen Moment — ich bereite den Salon vor…", "Un attimo — preparo il salone…", "لحظة — أجهّز الاستقبال…"),
  stellaGreeting: row(
    "Bonjour{name}. **STELLA** à votre service — un peu d'esprit, beaucoup de précision.\n\n{pulse}\n\nQuestion boutique, ou question de la vie : je suis là.",
    "Hello{name}. **STELLA** at your service — a little wit, a lot of precision.\n\n{pulse}\n\nShop question or life question: I am here.",
    "Hola{name}. **STELLA** a su servicio — un poco de ingenio, mucha precisión.\n\n{pulse}\n\nPregunta de tienda o de la vida: estoy aquí.",
    "Hallo{name}. **STELLA** zu Ihren Diensten — etwas Esprit, viel Präzision.\n\n{pulse}\n\nLadenfrage oder Lebensfrage: ich bin da.",
    "Buongiorno{name}. **STELLA** al vostro servizio — un po' di spirito, tanta precisione.\n\n{pulse}\n\nDomanda shop o di vita: ci sono.",
    "مرحباً{name}. **STELLA** في خدمتك — قليل من الخفة وكثير من الدقة.\n\n{pulse}\n\nسؤال متجر أو سؤال حياة: أنا هنا."
  ),
  stellaPulseEmpty: row("Panier vide — le catalogue est prêt, sans pression.", "Empty cart — the catalog is ready, no pressure.", "Carrito vacío — el catálogo está listo, sin presión.", "Warenkorb leer — der Katalog ist bereit, ohne Druck.", "Carrello vuoto — il catalogo è pronto, senza pressione.", "السلة فارغة — الكتالوج جاهز بلا ضغط."),
  stellaPulseCart: row("Votre panier attend : **{n}** référence(s).", "Your cart is waiting: **{n}** SKU(s).", "Su carrito espera: **{n}** referencia(s).", "Ihr Warenkorb wartet: **{n}** Artikel.", "Il carrello attende: **{n}** riferimento/i.", "سلتك تنتظر: **{n}** مرجع/مراجع."),
  stellaPulseOrders: row("Panier calme. **{n}** commande(s) encore en route.", "Quiet cart. **{n}** order(s) still in transit.", "Carrito en calma. **{n}** pedido(s) aún en camino.", "Ruhiger Warenkorb. **{n}** Bestellung(en) noch unterwegs.", "Carrello calmo. **{n}** ordine/i ancora in viaggio.", "السلة هادئة. **{n}** طلب/طلبات ما زالت في الطريق."),
  stellaError: row(
    "Je n'ai pas pu répondre : **{err}**\n\nEn attendant, Catalogue, Panier ou Commandes — les raccourcis sont juste au-dessus.",
    "I could not answer: **{err}**\n\nMeanwhile Catalog, Cart or Orders — shortcuts are just above.",
    "No pude responder: **{err}**\n\nMientras tanto Catálogo, Carrito o Pedidos — los atajos están arriba.",
    "Ich konnte nicht antworten: **{err}**\n\nKatalog, Warenkorb oder Bestellungen — die Kürzel sind oben.",
    "Non ho potuto rispondere: **{err}**\n\nNel frattempo Catalogo, Carrello o Ordini — le scorciatoie sono sopra.",
    "تعذّر الرد: **{err}**\n\nفي الأثناء الكتالوج أو السلة أو الطلبات — الاختصارات أعلى اللوحة."
  ),
  stellaFooter: row("Hôtesse B2B · compte live · questions libres", "B2B host · live account · free-form questions", "Anfitriona B2B · cuenta en vivo · preguntas libres", "B2B-Hostess · Live-Konto · freie Fragen", "Hostess B2B · account live · domande libere", "مضيفة أعمال · حساب مباشر · أسئلة حرّة"),
  stellaPlaceholder: row("Une commande, un article, une idée…", "An order, an item, an idea…", "Un pedido, un artículo, una idea…", "Eine Bestellung, ein Artikel, eine Idee…", "Un ordine, un articolo, un'idea…", "طلب، مادة، فكرة…"),
  stellaPistes: row("Pistes du moment", "Prompts of the moment", "Pistas del momento", "Impulse jetzt", "Spunti del momento", "اقتراحات اللحظة"),
  stellaLimit: row("Limite de {n} messages atteinte.", "Limit of {n} messages reached.", "Límite de {n} mensajes alcanzado.", "Limit von {n} Nachrichten erreicht.", "Limite di {n} messaggi raggiunto.", "تم بلوغ حد {n} رسالة."),
  stellaOpen: row("Ouvrir l'assistant Stella", "Open Stella assistant", "Abrir la asistente Stella", "Stella-Assistentin öffnen", "Apri l'assistente Stella", "فتح مساعدة ستيلا"),
  stellaClose: row("Fermer l'assistant Stella", "Close Stella assistant", "Cerrar la asistente Stella", "Stella-Assistentin schließen", "Chiudi l'assistente Stella", "إغلاق مساعدة ستيلا"),
  stellaLoading: row("STELLA cherche la bonne réponse…", "STELLA is finding the right answer…", "STELLA busca la respuesta adecuada…", "STELLA sucht die passende Antwort…", "STELLA cerca la risposta giusta…", "ستيلا تبحث عن الإجابة المناسبة…"),
  stellaAria: row("Assistante Stella", "Stella assistant", "Asistente Stella", "Assistentin Stella", "Assistente Stella", "المساعدة ستيلا"),
  stellaSug1: row("Comment passer une commande en 30 secondes ?", "How do I place an order in 30 seconds?", "¿Cómo hacer un pedido en 30 segundos?", "Wie bestelle ich in 30 Sekunden?", "Come ordinare in 30 secondi?", "كيف أقدّم طلباً في 30 ثانية؟"),
  stellaSug2: row("Où en sont mes commandes ?", "Where are my orders?", "¿Dónde están mis pedidos?", "Wo stehen meine Bestellungen?", "Dove sono i miei ordini?", "أين وصلت طلباتي؟"),
  stellaSug3: row("Récapitule mon panier", "Summarise my cart", "Resume mi carrito", "Fasse meinen Warenkorb zusammen", "Riassumi il mio carrello", "لخّص سلّتي"),
  stellaSug4: row("Explique-moi le parcours comme à un ami", "Explain the journey like to a friend", "Explícame el recorrido como a un amigo", "Erklären Sie den Ablauf wie einem Freund", "Spiegami il percorso come a un amico", "اشرح المسار كما لصديق"),
  stellaSugFav: row("Où trouver mes favoris ?", "Where are my favourites?", "¿Dónde están mis favoritos?", "Wo finde ich meine Favoriten?", "Dove trovo i preferiti?", "أين أجد المفضلة؟"),
  stellaSugStock: row("Qu'est-ce qui est dispo en ce moment ?", "What is available right now?", "¿Qué hay disponible ahora?", "Was ist gerade verfügbar?", "Cosa è disponibile ora?", "ما المتاح الآن؟"),
  stellaStatusOk: row("Compte à jour", "Account up to date", "Cuenta al día", "Konto aktuell", "Account aggiornato", "الحساب محدّث"),
  stellaStatusCart: row("Panier · {n} réf.", "Cart · {n} SKU", "Carrito · {n} ref.", "Warenkorb · {n} Art.", "Carrello · {n} rif.", "السلة · {n} مرجع"),
  stellaStatusOrders: row("{n} commande(s) en cours", "{n} order(s) in progress", "{n} pedido(s) en curso", "{n} Bestellung(en) laufend", "{n} ordine/i in corso", "{n} طلب قيد التنفيذ"),
  chatQuickCatalog: row("Catalogue", "Catalog", "Catálogo", "Katalog", "Catalogo", "الكتالوج"),
  chatQuickCart: row("Panier", "Cart", "Carrito", "Warenkorb", "Carrello", "السلة"),
  chatQuickOrders: row("Commandes", "Orders", "Pedidos", "Bestellungen", "Ordini", "الطلبات"),

  // —— AI hub / cockpit ——
  aiHubTitle: row("Radar IA", "AI Radar", "Radar IA", "KI-Radar", "Radar IA", "رادار الذكاء الاصطناعي"),
  aiHubSubtitle: row(
    "Six cerveaux — prévision, anomalies, péremption, slotting, chargement, assistant. Même logique métier, lecture cockpit.",
    "Six brains — forecast, anomalies, expiry, slotting, loading, assistant. Same business logic, cockpit reading.",
    "Seis cerebros — previsión, anomalías, caducidad, slotting, carga, asistente. Misma lógica, lectura de cabina.",
    "Sechs Gehirne — Prognose, Anomalien, MHD, Slotting, Verladung, Assistent. Gleiche Logik, Cockpit-Lesart.",
    "Sei cervelli — previsione, anomalie, scadenza, slotting, carico, assistente. Stessa logica, lettura cockpit.",
    "ستة عقول — توقع، شذوذات، انتهاء صلاحية، توضيب، تحميل، مساعد. نفس المنطق، قراءة قمرة القيادة."
  ),
  aiModForecast: row("Forecast — Prévision", "Forecast", "Forecast — Previsión", "Forecast — Prognose", "Forecast — Previsione", "التوقع"),
  aiModForecastText: row(
    "Holt-Winters + N-BEATS + hybride P90. Champion walk-forward.",
    "Holt-Winters + N-BEATS + hybrid P90. Walk-forward champion.",
    "Holt-Winters + N-BEATS + híbrido P90. Campeón walk-forward.",
    "Holt-Winters + N-BEATS + Hybrid P90. Walk-forward-Champion.",
    "Holt-Winters + N-BEATS + ibrido P90. Campione walk-forward.",
    "Holt-Winters + N-BEATS + هجين P90. بطل التحقق الأمامي."
  ),
  aiModAnomalies: row("Anomalies — Détection", "Anomalies — Detection", "Anomalías — Detección", "Anomalien — Erkennung", "Anomalie — Rilevamento", "الشذوذات — الكشف"),
  aiModAnomaliesText: row(
    "Ensemble IF + LOF + autoencodeur, calibrateur supervisé persisté.",
    "IF + LOF + autoencoder ensemble, persisted supervised calibrator.",
    "Conjunto IF + LOF + autoencoder, calibrador supervisado persistido.",
    "Ensemble IF + LOF + Autoencoder, persistierter überwachter Kalibrator.",
    "Ensemble IF + LOF + autoencoder, calibratore supervisionato persistito.",
    "تجميع IF + LOF + مشفّر تلقائي، مع معاير موجَّه محفوظ."
  ),
  aiModExpiry: row("Expiry — Péremption", "Expiry — Waste risk", "Expiry — Caducidad", "Expiry — MHD-Risiko", "Expiry — Scadenza", "انتهاء الصلاحية"),
  aiModExpiryText: row(
    "Runway DLC : restant vs vitesse vs jours, horizon 21 j et playbook FEFO.",
    "DLC runway: remaining vs velocity vs days, 21-day horizon and FEFO playbook.",
    "Pista DLC: restante vs velocidad vs días, horizonte 21 d y playbook FEFO.",
    "MHD-Runway: Rest vs. Tempo vs. Tage, 21-Tage-Horizont und FEFO-Playbook.",
    "Runway DLC: rimanenza vs velocità vs giorni, orizzonte 21 g e playbook FEFO.",
    "مدرج DLC: المتبقي مقابل السرعة مقابل الأيام، أفق 21 يوماً ودليل FEFO."
  ),
  aiModSlotting: row("Slotting — Emplacements", "Slotting — Locations", "Slotting — Ubicaciones", "Slotting — Stellplätze", "Slotting — Ubicazioni", "التوضيب — المواقع"),
  aiModSlottingText: row(
    "GMM 3 classes + affinité de picking. Suggestion, pas un move auto.",
    "3-class GMM + picking affinity. Suggestion, not an automatic move.",
    "GMM de 3 clases + afinidad de picking. Sugerencia, no un movimiento auto.",
    "GMM mit 3 Klassen + Picking-Affinität. Vorschlag, kein Auto-Move.",
    "GMM a 3 classi + affinità di picking. Suggerimento, non uno spostamento auto.",
    "GMM بثلاث فئات + تقارب الالتقاط. اقتراح وليس نقلاً تلقائياً."
  ),
  aiModLoad: row("Loading — Chargement", "Loading", "Loading — Carga", "Loading — Verladung", "Loading — Carico", "التحميل"),
  aiModLoadText: row(
    "Soute 3D + HAC + HGB + Pareto GPS. Plan d’aide, pas d’exécution stock.",
    "3D hold + HAC + HGB + GPS Pareto. Assist plan, no stock execution.",
    "Bodega 3D + HAC + HGB + Pareto GPS. Plan de ayuda, sin ejecución de stock.",
    "3D-Laderaum + HAC + HGB + GPS-Pareto. Hilfeplan, keine Bestandsbuchung.",
    "Stiva 3D + HAC + HGB + Pareto GPS. Piano di aiuto, nessuna esecuzione stock.",
    "عنبر ثلاثي الأبعاد + HAC + HGB + باريتو GPS. خطة مساعدة دون تنفيذ مخزون."
  ),
  aiModLlm: row("LLM — Assistant", "LLM — Assistant", "LLM — Asistente", "LLM — Assistent", "LLM — Assistente", "المساعد اللغوي"),
  aiModLlmText: row(
    "STOKI magasin et STELLA client B2B. Fallback d’intent si Groq est down.",
    "STOKI for the warehouse and STELLA for B2B clients. Intent fallback if Groq is down.",
    "STOKI almacén y STELLA cliente B2B. Respaldo de intención si Groq cae.",
    "STOKI fürs Lager und STELLA für B2B-Kunden. Intent-Fallback, falls Groq ausfällt.",
    "STOKI magazzino e STELLA cliente B2B. Fallback di intent se Groq è down.",
    "STOKI للمخزن وSTELLA لعملاء الأعمال. احتياطي نوايا إذا توقف Groq."
  ),
  aiAnomNone: row("Aucune anomalie non résolue pour le moment.", "No unresolved anomalies right now.", "Ninguna anomalía sin resolver por ahora.", "Derzeit keine offenen Anomalien.", "Nessuna anomalia irrisolta al momento.", "لا شذوذات غير محلولة حالياً."),
  aiAnomOne: row("1 anomalie non résolue à traiter.", "1 unresolved anomaly to handle.", "1 anomalía sin resolver por tratar.", "1 offene Anomalie zu bearbeiten.", "1 anomalia irrisolta da trattare.", "شذوذ واحد غير محلول للمعالجة."),
  aiAnomMany: row("{n} anomalies non résolues à traiter.", "{n} unresolved anomalies to handle.", "{n} anomalías sin resolver por tratar.", "{n} offene Anomalien zu bearbeiten.", "{n} anomalie irrisolte da trattare.", "{n} شذوذات غير محلولة للمعالجة."),
  aiTabOverview: row("Vue d'ensemble", "Overview", "Vista general", "Übersicht", "Panoramica", "نظرة عامة"),
  aiTabForecast: row("Prévision", "Forecast", "Previsión", "Prognose", "Previsione", "التوقع"),
  aiTabAnomalies: row("Anomalies", "Anomalies", "Anomalías", "Anomalien", "Anomalie", "الشذوذات"),
  aiTabExpiry: row("Péremption", "Expiry", "Caducidad", "MHD", "Scadenza", "انتهاء الصلاحية"),
  aiTabOptimisation: row("Optimisation", "Optimisation", "Optimización", "Optimierung", "Ottimizzazione", "التحسين"),
  aiTabLoad: row("Chargement", "Loading", "Carga", "Verladung", "Carico", "التحميل"),
  aiTabSlot: row("Emplacement", "Location", "Ubicación", "Stellplatz", "Ubicazione", "الموقع"),
  aiTabInsights: row("Insights", "Insights", "Perspectivas", "Insights", "Insight", "رؤى"),
  aiLoading: row("Chargement du module IA…", "Loading the AI module…", "Cargando el módulo IA…", "KI-Modul wird geladen…", "Caricamento del modulo IA…", "تحميل وحدة الذكاء الاصطناعي…"),
  aiLoadForecast: row("Chargement de la prévision…", "Loading forecast…", "Cargando la previsión…", "Prognose wird geladen…", "Caricamento della previsione…", "تحميل التوقع…"),
  aiLoadAnom: row("Chargement des anomalies…", "Loading anomalies…", "Cargando anomalías…", "Anomalien werden geladen…", "Caricamento delle anomalie…", "تحميل الشذوذات…"),
  aiLoadExpiry: row("Chargement du risque péremption…", "Loading expiry waste risk…", "Cargando riesgo de caducidad…", "MHD-Risiko wird geladen…", "Caricamento rischio scadenza…", "تحميل خطر انتهاء الصلاحية…"),
  aiLoadLoad: row("Chargement de l'optimisation chargement…", "Loading load optimisation…", "Cargando la optimización de carga…", "Ladeoptimierung wird geladen…", "Caricamento ottimizzazione carico…", "تحميل تحسين التحميل…"),
  aiLoadSlot: row("Chargement de l'optimisation emplacements…", "Loading slotting optimisation…", "Cargando la optimización de ubicaciones…", "Platzierungsoptimierung wird geladen…", "Caricamento ottimizzazione ubicazioni…", "تحميل تحسين المواقع…"),
  aiModuleFail: row("Ce module n’a pas pu s’afficher.", "This module could not be displayed.", "Este módulo no se pudo mostrar.", "Dieses Modul konnte nicht angezeigt werden.", "Questo modulo non è riuscito a essere visualizzato.", "تعذّر عرض هذه الوحدة."),
  aiRenderError: row("Erreur de rendu.", "Render error.", "Error de renderizado.", "Renderfehler.", "Errore di rendering.", "خطأ في العرض."),
  aiDashFail: row("Impossible de charger le dashboard IA.", "Could not load the AI dashboard.", "No se pudo cargar el panel IA.", "KI-Dashboard konnte nicht geladen werden.", "Impossibile caricare la dashboard IA.", "تعذّر تحميل لوحة الذكاء الاصطناعي."),
  aiRouteMissing: row(
    "Route introuvable — redémarrez le serveur backend pour appliquer les dernières mises à jour.",
    "Route not found — restart the backend to apply the latest updates.",
    "Ruta no encontrada — reinicie el backend para aplicar las últimas actualizaciones.",
    "Route nicht gefunden — starten Sie das Backend neu, um Updates zu laden.",
    "Percorso non trovato — riavviate il backend per applicare gli aggiornamenti.",
    "المسار غير موجود — أعد تشغيل الخادم لتطبيق آخر التحديثات."
  ),
  aiRetry: row("Réessayer", "Retry", "Reintentar", "Erneut versuchen", "Riprova", "إعادة المحاولة"),
  aiSync: row("Synchronisation…", "Syncing…", "Sincronizando…", "Synchronisierung…", "Sincronizzazione…", "جاري المزامنة…"),
  aiHeroKicker: row("Stokify · Radar IA", "Stokify · AI Radar", "Stokify · Radar IA", "Stokify · KI-Radar", "Stokify · Radar IA", "ستوكيفاي · رادار الذكاء"),
  aiHeroTitle: row("Cockpit Smart", "Smart Cockpit", "Cockpit Smart", "Smart Cockpit", "Cockpit Smart", "قمرة ذكية"),
  aiHeroAccent: row("Warehouse", "Warehouse", "Warehouse", "Warehouse", "Warehouse", "Warehouse"),
  aiHeroSub: row(
    "Six cerveaux pour lire le stock, recommander, puis journaliser une décision — sans exécuter le magasin.",
    "Six brains to read stock, recommend, then log a decision — without executing the warehouse.",
    "Seis cerebros para leer el stock, recomendar y registrar una decisión — sin ejecutar el almacén.",
    "Sechs Gehirne, um Bestand zu lesen, zu empfehlen und eine Entscheidung zu protokollieren — ohne das Lager auszuführen.",
    "Sei cervelli per leggere lo stock, raccomandare e registrare una decisione — senza eseguire il magazzino.",
    "ستة عقول لقراءة المخزون والتوصية ثم تسجيل قرار — دون تنفيذ المخزن."
  ),
  aiPulse: row("Santé", "Health", "Salud", "Gesundheit", "Salute", "الصحة"),
  aiConfidence: row("Fiabilité", "Reliability", "Fiabilidad", "Zuverlässigkeit", "Affidabilità", "الموثوقية"),
  aiDecisions: row("Décisions 14j", "14-day decisions", "Decisiones 14d", "Entscheidungen 14T", "Decisioni 14g", "قرارات 14 يوماً"),
  aiSyncLabel: row("Mise à jour", "Updated", "Actualización", "Aktualisiert", "Aggiornato", "آخر تحديث"),
  aiDateStart: row("Date de début", "Start date", "Fecha de inicio", "Startdatum", "Data di inizio", "تاريخ البداية"),
  aiDateEnd: row("Date de fin", "End date", "Fecha de fin", "Enddatum", "Data di fine", "تاريخ النهاية"),
  aiLive: row("Live", "Live", "En vivo", "Live", "Live", "مباشر"),
  aiPartial: row("Partielle", "Partial", "Parcial", "Teilweise", "Parziale", "جزئي"),
  aiLocal: row("Locale", "Local", "Local", "Lokal", "Locale", "محلي"),
  aiFastApiOff: row("FastAPI offline — fallbacks locaux actifs", "FastAPI offline — local fallbacks active", "FastAPI fuera de línea — respaldos locales activos", "FastAPI offline — lokale Fallbacks aktiv", "FastAPI offline — fallback locali attivi", "FastAPI غير متصل — الاحتياطات المحلية نشطة"),
  aiFastApiOn: row("Micro-service FastAPI joignable", "FastAPI microservice reachable", "Microservicio FastAPI accesible", "FastAPI-Microservice erreichbar", "Microservizio FastAPI raggiungibile", "خدمة FastAPI المصغّرة متاحة"),
  aiNavAria: row("Modules IA", "AI modules", "Módulos IA", "KI-Module", "Moduli IA", "وحدات الذكاء الاصطناعي"),
  aiJustNow: row("à l'instant", "just now", "justo ahora", "gerade eben", "adesso", "الآن"),
  aiMinAgo: row("il y a {n} min", "{n} min ago", "hace {n} min", "vor {n} Min", "{n} min fa", "منذ {n} د"),
  aiHourAgo: row("il y a {n}h", "{n}h ago", "hace {n} h", "vor {n} Std", "{n}h fa", "منذ {n} س"),
  aiIaActive: row("IA active", "AI active", "IA activa", "KI aktiv", "IA attiva", "الذكاء نشط"),
  aiIaFallback: row("IA en mode secours", "AI in backup mode", "IA en modo de respaldo", "KI im Notbetrieb", "IA in modalità di riserva", "الذكاء في وضع الاحتياط"),
  aiIaFallbackHint: row(
    "Résultats basés sur nos règles habituelles le temps que l'assistant IA se reconnecte",
    "Results are based on our usual rules until the AI assistant reconnects",
    "Resultados basados en nuestras reglas habituales mientras el asistente IA se reconecta",
    "Ergebnisse folgen den üblichen Regeln, bis der KI-Assistent wieder verbunden ist",
    "Risultati basati sulle regole abituali finché l'assistente IA non si riconnette",
    "النتائج مبنية على قواعدنا المعتادة إلى أن يعود المساعد الذكي"
  ),
  aiSystemStatus: row("Statut système", "System status", "Estado del sistema", "Systemstatus", "Stato sistema", "حالة النظام"),
  aiSystemStatusAria: row("Ouvrir le statut système", "Open system status", "Abrir el estado del sistema", "Systemstatus öffnen", "Apri stato sistema", "فتح حالة النظام"),
  aiStoryKicker: row("À retenir", "To remember", "A recordar", "Zum Merken", "Da ricordare", "للتذكّر"),
  aiStoryTitle: row("Ce qu'il faut retenir aujourd'hui", "What to remember today", "Lo que hay que recordar hoy", "Was Sie heute merken sollten", "Cosa ricordare oggi", "ما يجب تذكّره اليوم"),
  aiStoryCalm: row(
    "Rien d'urgent : le stock suit son rythme habituel, et l'IA n'a pas détecté d'alerte à traiter en priorité.",
    "Nothing urgent: stock is following its usual pace, and AI has not flagged a priority alert.",
    "Nada urgente: el stock sigue su ritmo habitual y la IA no ha detectado ninguna alerta prioritaria.",
    "Nichts Dringendes: der Bestand folgt dem üblichen Tempo, und die KI hat keine Prioritätswarnung erkannt.",
    "Niente di urgente: lo stock segue il ritmo abituale e l'IA non ha rilevato allarmi prioritari.",
    "لا شيء عاجل: المخزون يسير بإيقاعه المعتاد ولم يرصد الذكاء تنبيهاً ذا أولوية."
  ),
  aiStoryRuptureOne: row(
    "1 article risque la rupture cette semaine.",
    "1 item is at risk of stockout this week.",
    "1 artículo corre riesgo de ruptura esta semana.",
    "1 Artikel droht diese Woche auszugehen.",
    "1 articolo rischia la rottura di stock questa settimana.",
    "مادّة واحدة مهددة بالنفاذ هذا الأسبوع."
  ),
  aiStoryRuptureMany: row(
    "{n} articles risquent la rupture cette semaine.",
    "{n} items are at risk of stockout this week.",
    "{n} artículos corren riesgo de ruptura esta semana.",
    "{n} Artikel drohen diese Woche auszugehen.",
    "{n} articoli rischiano la rottura di stock questa settimana.",
    "{n} مواد مهددة بالنفاذ هذا الأسبوع."
  ),
  aiStoryAnomOne: row(
    "1 mouvement de stock semble inhabituel.",
    "1 stock movement looks unusual.",
    "1 movimiento de stock parece inusual.",
    "1 Bestandsbewegung wirkt ungewöhnlich.",
    "1 movimento di stock sembra insolito.",
    "حركة مخزون واحدة تبدو غير معتادة."
  ),
  aiStoryAnomMany: row(
    "{n} mouvements de stock semblent inhabituels.",
    "{n} stock movements look unusual.",
    "{n} movimientos de stock parecen inusuales.",
    "{n} Bestandsbewegungen wirken ungewöhnlich.",
    "{n} movimenti di stock sembrano insoliti.",
    "{n} حركات مخزون تبدو غير معتادة."
  ),
  aiStoryRecoOne: row(
    "1 action est recommandée pour mieux s'organiser.",
    "1 action is recommended to get better organised.",
    "Se recomienda 1 acción para organizarse mejor.",
    "1 Aktion wird empfohlen, um sich besser zu organisieren.",
    "È consigliata 1 azione per organizzarsi meglio.",
    "إجراء واحد موصى به لتنظيم أفضل."
  ),
  aiStoryRecoMany: row(
    "{n} actions sont recommandées pour mieux s'organiser.",
    "{n} actions are recommended to get better organised.",
    "Se recomiendan {n} acciones para organizarse mejor.",
    "{n} Aktionen werden empfohlen, um sich besser zu organisieren.",
    "Sono consigliate {n} azioni per organizzarsi meglio.",
    "{n} إجراءات موصى بها لتنظيم أفضل."
  ),
  aiStoryExpiryOne: row(
    "1 lot approche de sa date limite.",
    "1 lot is approaching its expiry date.",
    "1 lote se acerca a su fecha límite.",
    "1 Los nähert sich dem Verfallsdatum.",
    "1 lotto si avvicina alla data limite.",
    "دفعة واحدة تقترب من تاريخ انتهائها."
  ),
  aiStoryExpiryMany: row(
    "{n} lots approchent de leur date limite.",
    "{n} lots are approaching their expiry date.",
    "{n} lotes se acercan a su fecha límite.",
    "{n} Lose nähern sich dem Verfallsdatum.",
    "{n} lotti si avvicinano alla data limite.",
    "{n} دفعات تقترب من تاريخ انتهائها."
  ),
  aiStoryForecast: row(
    "{n} articles ont une prévision de demande active.",
    "{n} items have an active demand forecast.",
    "{n} artículos tienen una previsión de demanda activa.",
    "{n} Artikel haben eine aktive Nachfrageprognose.",
    "{n} articoli hanno una previsione di domanda attiva.",
    "{n} مواد لديها توقّع طلب نشط."
  ),
  aiStoryForecastTitle: row("Ce qui va se vendre", "What will sell", "Lo que se va a vender", "Was sich verkaufen wird", "Cosa si venderà", "ما الذي سيُباع"),
  aiStoryAnomaliesTitle: row("Ce qui sort de l'ordinaire", "What stands out", "Lo que sale de lo habitual", "Was aus dem Rahmen fällt", "Cosa esce dall'ordinario", "ما يخرج عن المعتاد"),
  aiStoryOptimisationTitle: row("Comment mieux s'organiser", "How to get better organised", "Cómo organizarse mejor", "Wie Sie sich besser organisieren", "Come organizzarsi meglio", "كيف تنتظم بشكل أفضل"),
  aiStoryInsightsTitle: row("Recommandations du moment", "Recommendations right now", "Recomendaciones del momento", "Aktuelle Empfehlungen", "Raccomandazioni del momento", "توصيات اللحظة"),
  aiKpiForecast: row("Prévisions actives", "Active forecasts", "Previsiones activas", "Aktive Prognosen", "Previsioni attive", "توقعات نشطة"),
  aiKpiForecastHint: row(
    "Articles pour lesquels l'IA anticipe la demande",
    "Items where AI is anticipating demand",
    "Artículos para los que la IA anticipa la demanda",
    "Artikel, für die die KI die Nachfrage vorhersieht",
    "Articoli per i quali l'IA anticipa la domanda",
    "مواد يتوقع الذكاء طلبها"
  ),
  aiKpiAnomalies: row("Anomalies ouvertes", "Open anomalies", "Anomalías abiertas", "Offene Anomalien", "Anomalie aperte", "شذوذات مفتوحة"),
  aiKpiAnomaliesHint: row(
    "Mouvements de stock qui sortent de l'habituel",
    "Stock movements that fall outside the usual pattern",
    "Movimientos de stock fuera de lo habitual",
    "Bestandsbewegungen außerhalb des Üblichen",
    "Movimenti di stock fuori dall'abituale",
    "حركات مخزون خارجة عن المعتاد"
  ),
  aiKpiActions: row("Actions recommandées", "Recommended actions", "Acciones recomendadas", "Empfohlene Aktionen", "Azioni consigliate", "إجراءات موصى بها"),
  aiKpiActionsHint: row(
    "Pistes concrètes pour mieux piloter le stock",
    "Practical next steps to steer stock more clearly",
    "Pistas concretas para pilotar mejor el stock",
    "Konkrete Hinweise, um den Bestand klarer zu steuern",
    "Indicazioni concrete per guidare meglio lo stock",
    "خطوات عملية لتوجيه المخزون بوضوح أكبر"
  ),
  aiKpiReliability: row("Fiabilité des prévisions", "Forecast reliability", "Fiabilidad de las previsiones", "Zuverlässigkeit der Prognosen", "Affidabilità delle previsioni", "موثوقية التوقعات"),
  aiKpiReliabilityHint: row(
    "Basé sur la précision des prévisions passées",
    "Based on how accurate past forecasts were",
    "Basado en la precisión de las previsiones pasadas",
    "Basiert auf der Genauigkeit früherer Prognosen",
    "Basato sulla precisione delle previsioni passate",
    "مبني على دقة التوقعات السابقة"
  ),
  aiOpenDetail: row("Voir le détail", "See details", "Ver el detalle", "Details ansehen", "Vedi il dettaglio", "عرض التفاصيل"),
  aiStoryOpen: row("Ouvrir", "Open", "Abrir", "Öffnen", "Apri", "فتح"),

  // —— Common errors / toasts ——
  errGeneric: row("Erreur", "Error", "Error", "Fehler", "Errore", "خطأ"),
  errUnknown: row("Erreur inconnue", "Unknown error", "Error desconocido", "Unbekannter Fehler", "Errore sconosciuto", "خطأ غير معروف"),
  errEmailRequired: row("Email requis", "Email required", "Correo obligatorio", "E-Mail erforderlich", "Email obbligatoria", "البريد مطلوب"),
  errEmailInvalid: row("Email invalide", "Invalid email", "Correo no válido", "Ungültige E-Mail", "Email non valida", "بريد غير صالح"),
  errPasswordRequired: row("Mot de passe requis", "Password required", "Contraseña obligatoria", "Passwort erforderlich", "Password obbligatoria", "كلمة المرور مطلوبة"),
  errPasswordMin: row("Mot de passe : min. 8 caractères", "Password: min. 8 characters", "Contraseña: mín. 8 caracteres", "Passwort: mind. 8 Zeichen", "Password: min. 8 caratteri", "كلمة المرور: 8 أحرف على الأقل"),
  errNameRequired: row("Nom requis", "Last name required", "Apellido obligatorio", "Nachname erforderlich", "Cognome obbligatorio", "اللقب مطلوب"),
  errNameMin: row("Nom : min. 2 caractères", "Last name: min. 2 characters", "Apellido: mín. 2 caracteres", "Nachname: mind. 2 Zeichen", "Cognome: min. 2 caratteri", "اللقب: حرفان على الأقل"),
  errFirstRequired: row("Prénom requis", "First name required", "Nombre obligatorio", "Vorname erforderlich", "Nome obbligatorio", "الاسم مطلوب"),
  errFirstMin: row("Prénom : min. 2 caractères", "First name: min. 2 characters", "Nombre: mín. 2 caracteres", "Vorname: mind. 2 Zeichen", "Nome: min. 2 caratteri", "الاسم: حرفان على الأقل"),
  errConfirmRequired: row("Confirmation requise", "Confirmation required", "Confirmación obligatoria", "Bestätigung erforderlich", "Conferma obbligatoria", "التأكيد مطلوب"),
  errConfirmMismatch: row("La confirmation ne correspond pas", "Confirmation does not match", "La confirmación no coincide", "Bestätigung stimmt nicht überein", "La conferma non corrisponde", "التأكيد غير مطابق"),
  errGroqKey: row("Clé API Groq invalide ou manquante.", "Invalid or missing Groq API key.", "Clave API Groq inválida o ausente.", "Ungültiger oder fehlender Groq-API-Schlüssel.", "Chiave API Groq non valida o mancante.", "مفتاح Groq غير صالح أو مفقود."),
  errGroqRate: row("Limite de requêtes Groq atteinte. Réessayez dans quelques instants.", "Groq rate limit reached. Try again in a moment.", "Límite de peticiones Groq alcanzado. Reintente en un instante.", "Groq-Ratenlimit erreicht. Gleich erneut versuchen.", "Limite richieste Groq raggiunta. Riprovate tra poco.", "تم بلوغ حد طلبات Groq. أعد المحاولة بعد لحظات."),
  errGroqModel: row("Modèle Groq indisponible. Contactez l'administrateur.", "Groq model unavailable. Contact an administrator.", "Modelo Groq no disponible. Contacte al administrador.", "Groq-Modell nicht verfügbar. Administrator kontaktieren.", "Modello Groq non disponibile. Contattate l'amministratore.", "نموذج Groq غير متاح. تواصل مع المسؤول."),
  errAiService: row("Erreur du service IA", "AI service error", "Error del servicio IA", "KI-Dienstfehler", "Errore del servizio IA", "خطأ في خدمة الذكاء"),
  errDb: row("Erreur base de données", "Database error", "Error de base de datos", "Datenbankfehler", "Errore del database", "خطأ في قاعدة البيانات"),
  errClientOnly: row("Accès réservé aux clients", "Customers only", "Acceso reservado a clientes", "Nur für Kunden", "Accesso riservato ai clienti", "الوصول مخصص للعملاء"),
  errNotLinked: row(
    "Votre compte n'est pas encore rattaché à une fiche client. Contactez l'administrateur.",
    "Your account is not linked to a customer record yet. Contact an administrator.",
    "Su cuenta aún no está vinculada a una ficha de cliente. Contacte al administrador.",
    "Ihr Konto ist noch keiner Kundenakte zugeordnet. Administrator kontaktieren.",
    "L'account non è ancora collegato a una scheda cliente. Contattate l'amministratore.",
    "حسابك غير مرتبط بعد ببطاقة عميل. تواصل مع المسؤول."
  ),
  errAiDown: row("Assistant temporairement indisponible", "Assistant temporarily unavailable", "Asistente temporalmente no disponible", "Assistent vorübergehend nicht verfügbar", "Assistente temporaneamente non disponibile", "المساعد غير متاح مؤقتاً"),
  errMsgRequired: row("Message requis", "Message required", "Mensaje obligatorio", "Nachricht erforderlich", "Messaggio obbligatorio", "الرسالة مطلوبة"),
  errSocieteRequired: row("Société active requise pour le chat IA", "An active company is required for AI chat", "Se requiere una empresa activa para el chat IA", "Aktives Unternehmen für den KI-Chat erforderlich", "Società attiva richiesta per la chat IA", "يلزم وجود شركة نشطة للدردشة"),
};

const packed = fromRows(ROWS);

function extra(fr, en, es, de, it, ar) {
  packed.PHRASE_INDEX[fr] = { en, es, de, it, ar };
}

extra("Accueil", "Home", "Inicio", "Startseite", "Home", "الرئيسية");
extra("Connexion", "Sign in", "Iniciar sesión", "Anmelden", "Accedi", "تسجيل الدخول");
extra("Inscription", "Sign up", "Registro", "Registrierung", "Registrazione", "إنشاء حساب");
extra("Radar IA", "AI Radar", "Radar IA", "KI-Radar", "Radar IA", "رادار الذكاء الاصطناعي");
extra("Vue d'ensemble", "Overview", "Vista general", "Übersicht", "Panoramica", "نظرة عامة");
extra("Prévision", "Forecast", "Previsión", "Prognose", "Previsione", "التوقع");
extra("Chargement", "Loading", "Carga", "Verladung", "Carico", "التحميل");
extra("Emplacement", "Location", "Ubicación", "Stellplatz", "Ubicazione", "الموقع");
extra("Insights", "Insights", "Perspectivas", "Insights", "Insight", "رؤى");
extra("Réessayer", "Retry", "Reintentar", "Erneut versuchen", "Riprova", "إعادة المحاولة");
extra("Synchronisation…", "Syncing…", "Sincronizando…", "Synchronisierung…", "Sincronizzazione…", "جاري المزامنة…");
extra("Quantités, images articles, emplacements et alertes en temps réel", "Quantities, item images, locations and live alerts", "Cantidades, imágenes, ubicaciones y alertas en tiempo real", "Mengen, Artikelbilder, Stellplätze und Live-Alarme", "Quantità, immagini, ubicazioni e alert in tempo reale", "كميات وصور ومواقع وتنبيهات مباشرة");
extra("Référentiel produits — images, stock, prix et statut", "Product master — images, stock, prices and status", "Maestro de productos — imágenes, stock, precios y estado", "Artikelstamm — Bilder, Bestand, Preise und Status", "Anagrafica prodotti — immagini, stock, prezzi e stato", "مرجع المنتجات — صور ومخزون وأسعار وحالة");
extra("Référentiel fournisseurs — lié aux achats, conditions commerciales et délais de paiement.", "Supplier master — linked to purchasing, terms and payment delays.", "Maestro de proveedores — ligado a compras, condiciones y plazos.", "Lieferantenstamm — verknüpft mit Einkauf, Konditionen und Zahlungszielen.", "Anagrafica fornitori — legata ad acquisti, condizioni e tempi di pagamento.", "مرجع المورّدين — مرتبط بالمشتريات والشروط وآجال الدفع.");
extra("Vue synthétique des flux achats, ventes, impayés et rentabilité", "Synthetic view of purchases, sales, unpaid invoices and profitability", "Vista sintética de compras, ventas, impagos y rentabilidad", "Synthese aus Einkauf, Verkauf, offenen Posten und Rentabilität", "Vista sintetica di acquisti, vendite, insoluti e redditività", "عرض مركّز لتدفقات الشراء والبيع والمتأخرات والربحية");
extra("CMP, FIFO, LIFO, Dernier Prix d'Achat et comparaison des méthodes", "WAC, FIFO, LIFO, last purchase price and method comparison", "CMP, FIFO, LIFO, último precio de compra y comparación de métodos", "GD, FIFO, LIFO, letzter Einkaufspreis und Methodenvergleich", "CMP, FIFO, LIFO, ultimo prezzo d'acquisto e confronto metodi", "متوسط مرجح، FIFO، LIFO، آخر سعر شراء ومقارنة الطرق");
extra("Valorisation et charges logistiques", "Valuation and logistics charges", "Valoración y cargas logísticas", "Bewertung und Logistikkosten", "Valorizzazione e oneri logistici", "تقييم ورسوم لوجستية");
extra("Gestion des lots à rappeler et notifications clients", "Lot recall management and customer notifications", "Gestión de lotes a retirar y notificaciones a clientes", "Rückrufverwaltung und Kundenbenachrichtigungen", "Gestione lotti da ritirare e notifiche clienti", "إدارة دفعات السحب وإشعارات العملاء");
extra("Accès réservé aux administrateurs", "Administrators only", "Acceso reservado a administradores", "Nur für Administratoren", "Accesso riservato agli amministratori", "الوصول مخصص للمسؤولين");
extra("Détail lot scanné", "Scanned lot detail", "Detalle del lote escaneado", "Detail des gescannten Loses", "Dettaglio lotto scansionato", "تفاصيل الدفعة الممسوحة");
extra("Détail de la ligne de stock scannée", "Scanned stock line detail", "Detalle de la línea de stock escaneada", "Detail der gescannten Bestandszeile", "Dettaglio della riga di stock scansionata", "تفاصيل سطر المخزون الممسوح");
extra("Scan lot", "Scan lot", "Escanear lote", "Los scannen", "Scansiona lotto", "مسح دفعة");
extra("Scan stock", "Scan stock", "Escanear stock", "Bestand scannen", "Scansiona stock", "مسح مخزون");
extra("Scan terrain", "Field scan", "Escaneo de campo", "Feldscan", "Scan sul campo", "مسح ميداني");
extra("Achat introuvable", "Purchase not found", "Compra no encontrada", "Einkauf nicht gefunden", "Acquisto non trovato", "الشراء غير موجود");
extra("Vente introuvable", "Sale not found", "Venta no encontrada", "Verkauf nicht gefunden", "Vendita non trovata", "البيع غير موجود");
extra("Profil mis à jour avec succès", "Profile updated successfully", "Perfil actualizado con éxito", "Profil erfolgreich aktualisiert", "Profilo aggiornato con successo", "تم تحديث الملف بنجاح");
extra("Permissions enregistrées avec succès", "Permissions saved successfully", "Permisos guardados con éxito", "Berechtigungen erfolgreich gespeichert", "Permessi salvati con successo", "تم حفظ الصلاحيات بنجاح");
extra("Compte supprimé définitivement", "Account permanently deleted", "Cuenta eliminada definitivamente", "Konto endgültig gelöscht", "Account eliminato definitivamente", "حُذف الحساب نهائياً");
extra("Rotation des stocks", "Stock turnover", "Rotación de stocks", "Bestandsumschlag", "Rotazione delle scorte", "دوران المخزون");
extra("Écarts inventaire", "Inventory variances", "Desviaciones de inventario", "Inventurdifferenzen", "Scostamenti di inventario", "فروقات الجرد");
extra("Stock dormant", "Idle stock", "Stock inactivo", "Totes Inventar", "Stock dormiente", "مخزون راكد");
extra("Analyse marge brute et nette par article", "Gross and net margin analysis by item", "Análisis de margen bruto y neto por artículo", "Brutto- und Nettomargenanalyse je Artikel", "Analisi del margine lordo e netto per articolo", "تحليل الهامش الإجمالي والصافي حسب المادة");
extra("Rentabilité article", "Item profitability", "Rentabilidad del artículo", "Artikelrentabilität", "Redditività articolo", "ربحية المادة");
extra("Optimisation des emplacements", "Location optimisation", "Optimización de ubicaciones", "Platzierungsoptimierung", "Ottimizzazione ubicazioni", "تحسين المواقع");
extra("Optimisation chargement", "Load optimisation", "Optimización de carga", "Ladeoptimierung", "Ottimizzazione carico", "تحسين التحميل");
extra("Journal d'audit stock", "Stock audit log", "Auditoría de stock", "Bestands-Audit", "Registro audit stock", "سجل تدقيق المخزون");
extra("Mouvements de stock", "Stock movements", "Movimientos de stock", "Bestandsbewegungen", "Movimenti di stock", "حركات المخزون");
extra("Numéros de série", "Serial numbers", "Números de serie", "Seriennummern", "Numeri di serie", "أرقام تسلسلية");
extra("Coûts de stockage", "Storage costs", "Costes de almacenaje", "Lagerkosten", "Costi di stoccaggio", "تكاليف التخزين");
extra("Valorisation du stock", "Stock valuation", "Valoración de stock", "Bestandsbewertung", "Valorizzazione dello stock", "تقييم المخزون");
extra("Rappel produit", "Product recall", "Retirada de producto", "Produktrückruf", "Ritiro prodotto", "سحب منتج");
extra("Erreur", "Error", "Error", "Fehler", "Errore", "خطأ");
extra("Identifiants incorrects", "Incorrect credentials", "Credenciales incorrectas", "Ungültige Anmeldedaten", "Credenziali non corrette", "بيانات اعتماد غير صحيحة");
extra("Email requis", "Email required", "Correo obligatorio", "E-Mail erforderlich", "Email obbligatoria", "البريد مطلوب");
extra("Email invalide", "Invalid email", "Correo no válido", "Ungültige E-Mail", "Email non valida", "بريد غير صالح");
extra("Mot de passe requis", "Password required", "Contraseña obligatoria", "Passwort erforderlich", "Password obbligatoria", "كلمة المرور مطلوبة");
extra("Mot de passe : min. 8 caractères", "Password: min. 8 characters", "Contraseña: mín. 8 caracteres", "Passwort: mind. 8 Zeichen", "Password: min. 8 caratteri", "كلمة المرور: 8 أحرف على الأقل");
extra("Nom requis", "Last name required", "Apellido obligatorio", "Nachname erforderlich", "Cognome obbligatorio", "اللقب مطلوب");
extra("Prénom requis", "First name required", "Nombre obligatorio", "Vorname erforderlich", "Nome obbligatorio", "الاسم مطلوب");
extra("La confirmation ne correspond pas", "Confirmation does not match", "La confirmación no coincide", "Bestätigung stimmt nicht überein", "La conferma non corrisponde", "التأكيد غير مطابق");
extra("Confirmation requise", "Confirmation required", "Confirmación obligatoria", "Bestätigung erforderlich", "Conferma obbligatoria", "التأكيد مطلوب");
extra("Nom : min. 2 caractères", "Last name: min. 2 characters", "Apellido: mín. 2 caracteres", "Nachname: mind. 2 Zeichen", "Cognome: min. 2 caratteri", "اللقب: حرفان على الأقل");
extra("Prénom : min. 2 caractères", "First name: min. 2 characters", "Nombre: mín. 2 caracteres", "Vorname: mind. 2 Zeichen", "Nome: min. 2 caratteri", "الاسم: حرفان على الأقل");
extra("Clé API Groq invalide ou manquante.", "Invalid or missing Groq API key.", "Clave API Groq inválida o ausente.", "Ungültiger oder fehlender Groq-API-Schlüssel.", "Chiave API Groq non valida o mancante.", "مفتاح Groq غير صالح أو مفقود.");
extra("Erreur du service IA", "AI service error", "Error del servicio IA", "KI-Dienstfehler", "Errore del servizio IA", "خطأ في خدمة الذكاء");
extra("Erreur base de données", "Database error", "Error de base de datos", "Datenbankfehler", "Errore del database", "خطأ في قاعدة البيانات");
extra("Accès réservé aux clients", "Customers only", "Acceso reservado a clientes", "Nur für Kunden", "Accesso riservato ai clienti", "الوصول مخصص للعملاء");
extra("Message requis", "Message required", "Mensaje obligatorio", "Nachricht erforderlich", "Messaggio obbligatorio", "الرسالة مطلوبة");
extra("Pistes", "Prompts", "Pistas", "Impulse", "Spunti", "اقتراحات");
extra("Copilote magasin", "Warehouse copilot", "Copiloto de almacén", "Lager-Copilot", "Copilota magazzino", "مساعد المخزن");
extra("Hôtesse B2B", "B2B host", "Anfitriona B2B", "B2B-Hostess", "Hostess B2B", "مضيفة أعمال");
extra("En ligne", "Online", "En línea", "Online", "Online", "متصل");
extra("Nouvelle conversation", "New conversation", "Nueva conversación", "Neue Unterhaltung", "Nuova conversazione", "محادثة جديدة");
extra("SSO entreprise", "Company SSO", "SSO empresa", "Firmen-SSO", "SSO aziendale", "دخول موحّد للشركة");
extra("Se souvenir de moi", "Remember me", "Recordarme", "Angemeldet bleiben", "Ricordami", "تذكّرني");
extra("Se connecter", "Sign in", "Iniciar sesión", "Anmelden", "Accedi", "تسجيل الدخول");
extra("Créer mon compte", "Create my account", "Crear mi cuenta", "Konto erstellen", "Crea il mio account", "إنشاء حسابي");
extra("Mot de passe oublié ?", "Forgot password?", "¿Olvidó su contraseña?", "Passwort vergessen?", "Password dimenticata?", "نسيت كلمة المرور؟");
extra("Confirmer le mot de passe", "Confirm password", "Confirmar contraseña", "Passwort bestätigen", "Conferma password", "تأكيد كلمة المرور");
extra("Adresse e-mail", "Email address", "Correo electrónico", "E-Mail-Adresse", "Indirizzo email", "البريد الإلكتروني");
extra("Ce module n’a pas pu s’afficher.", "This module could not be displayed.", "Este módulo no se pudo mostrar.", "Dieses Modul konnte nicht angezeigt werden.", "Questo modulo non è riuscito a essere visualizzato.", "تعذّر عرض هذه الوحدة.");
extra("Erreur de rendu.", "Render error.", "Error de renderizado.", "Renderfehler.", "Errore di rendering.", "خطأ في العرض.");
extra("Quatre regards sur le stock", "Four views of the stock", "Cuatro miradas sobre el stock", "Vier Blicke auf den Bestand", "Quattro sguardi sullo stock", "أربع نظرات على المخزون");
extra("Le détail s’ouvre d’un clic — rien n’est exécuté depuis cette page.", "Details open in one click — nothing is executed from this page.", "El detalle se abre con un clic — nada se ejecuta desde esta página.", "Details öffnen sich mit einem Klick — von hier wird nichts ausgeführt.", "Il dettaglio si apre con un clic — da questa pagina non si esegue nulla.", "التفاصيل تُفتح بنقرة — لا يُنفَّذ شيء من هذه الصفحة.");
extra("Les pistes les plus utiles en ce moment", "The most useful leads right now", "Las pistas más útiles en este momento", "Die nützlichsten Hinweise gerade jetzt", "Le piste più utili in questo momento", "المسارات الأكثر فائدة الآن");
extra("Priorité", "Priority", "Prioridad", "Priorität", "Priorità", "الأولوية");
extra("Fiabilité", "Reliability", "Fiabilidad", "Zuverlässigkeit", "Affidabilità", "الموثوقية");
extra("Ce qui va se vendre", "What will sell", "Lo que se va a vender", "Was sich verkaufen wird", "Cosa si venderà", "ما الذي سيُباع");
extra("Ce qui sort de l'ordinaire", "What stands out", "Lo que sale de lo habitual", "Was aus dem Rahmen fällt", "Cosa esce dall'ordinario", "ما يخرج عن المعتاد");
extra("Comment mieux s'organiser", "How to get better organised", "Cómo organizarse mejor", "Wie Sie sich besser organisieren", "Come organizzarsi meglio", "كيف تنتظم بشكل أفضل");
extra("Recommandations du moment", "Recommendations right now", "Recomendaciones del momento", "Aktuelle Empfehlungen", "Raccomandazioni del momento", "توصيات اللحظة");
extra("Organisation du stock", "Stock organisation", "Organización del stock", "Bestandsorganisation", "Organizzazione dello stock", "تنظيم المخزون");
extra("IA active", "AI active", "IA activa", "KI aktiv", "IA attiva", "الذكاء نشط");
extra("IA en mode secours", "AI in backup mode", "IA en modo de respaldo", "KI im Notbetrieb", "IA in modalità di riserva", "الذكاء في وضع الاحتياط");
extra("Statut système", "System status", "Estado del sistema", "Systemstatus", "Stato sistema", "حالة النظام");
extra("Voir le détail", "See details", "Ver el detalle", "Details ansehen", "Vedi il dettaglio", "عرض التفاصيل");
extra("En direct", "Live", "En directo", "Live", "In diretta", "مباشر");
extra("Rien à signaler pour ce filtre", "Nothing to report for this filter", "Nada que señalar para este filtro", "Nichts anzuzeigen für diesen Filter", "Nulla da segnalare per questo filtro", "لا شيء لهذا المرشّح");
extra("IA Ensemble (GBM + Deep Learning)", "Ensemble AI (GBM + Deep Learning)", "IA conjunto (GBM + Deep Learning)", "Ensemble-KI (GBM + Deep Learning)", "IA ensemble (GBM + Deep Learning)", "ذكاء مجموعي (GBM + تعلم عميق)");
extra("IA GBM", "GBM AI", "IA GBM", "GBM-KI", "IA GBM", "ذكاء GBM");
extra("Heuristique (secours)", "Heuristic (fallback)", "Heurística (respaldo)", "Heuristik (Reserve)", "Euristica (riserva)", "قاعدة احتياطية");
extra("Pas encore entraîné", "Not trained yet", "Aún no entrenado", "Noch nicht trainiert", "Non ancora addestrato", "لم يُدرَّب بعد");
extra("Version", "Version", "Versión", "Version", "Versione", "الإصدار");
extra("lots simulés", "simulated lots", "lotes simulados", "simulierte Lose", "lotti simulati", "دفعات محاكاة");
extra("lots réels", "real lots", "lotes reales", "echte Lose", "lotti reali", "دفعات حقيقية");
extra("Carte du modèle", "Model card", "Ficha del modelo", "Modellkarte", "Scheda del modello", "بطاقة النموذج");
extra("Fermer", "Close", "Cerrar", "Schließen", "Chiudi", "إغلاق");
extra("Modèle pré-entraîné sur simulation, affiné au fil de vos lots réels", "Model pretrained on simulation, refined as your real lots arrive", "Modelo preentrenado en simulación, afinado con sus lotes reales", "Modell auf Simulation vortrainiert, verfeinert mit Ihren echten Losen", "Modello pre-addestrato in simulazione, affinato sui lotti reali", "نموذج مُدرَّب مسبقًا على محاكاة، ويُصقل مع دفعاتكم الحقيقية");
extra("Affiné sur les lots réels observés à la DLC", "Refined on real lots observed at expiry", "Afinado con lotes reales observados en la caducidad", "Verfeinert mit echten Losen zum Verfallsdatum", "Affinato sui lotti reali osservati alla scadenza", "مُصقل على دفعات حقيقية لوحظت عند انتهاء الصلاحية");
extra("Données réelles", "Real data", "Datos reales", "Echte Daten", "Dati reali", "بيانات حقيقية");
extra("contre la formule physique", "versus the physical formula", "frente a la fórmula física", "gegenüber der physikalischen Formel", "rispetto alla formula fisica", "مقابل الصيغة الفيزيائية");
extra("Perte train / validation", "Train / validation loss", "Pérdida train / validación", "Train-/Validierungsverlust", "Perdita train / validazione", "خسارة التدريب / التحقق");
extra("Fiabilité", "Reliability", "Fiabilidad", "Zuverlässigkeit", "Affidabilità", "الموثوقية");
extra("Importance des variables", "Feature importance", "Importancia de variables", "Merkmalswichtigkeit", "Importanza delle variabili", "أهمية المتغيرات");
extra("Et si ?", "What if?", "¿Y si?", "Was wäre wenn?", "E se?", "ماذا لو؟");
extra("Accélération des ventes", "Sales acceleration", "Aceleración de ventas", "Verkaufsbeschleunigung", "Accelerazione delle vendite", "تسريع المبيعات");
extra("DLC supplémentaire", "Extra shelf life", "Caducidad adicional", "Zusätzliche Haltbarkeit", "Scadenza aggiuntiva", "صلاحية إضافية");
extra("Simulation indisponible", "Simulation unavailable", "Simulación no disponible", "Simulation nicht verfügbar", "Simulazione non disponibile", "المحاكاة غير متاحة");
extra("avant", "before", "antes", "vorher", "prima", "قبل");
extra("valeur sauvée", "value saved", "valor salvado", "geretteter Wert", "valore salvato", "قيمة مُنقذة");
extra("déplacez un curseur", "move a slider", "mueva un control", "Schieberegler bewegen", "spostate un cursore", "حرّك المؤشر");
extra("Suivi réel", "Live monitoring", "Seguimiento real", "Echtes Monitoring", "Monitoraggio reale", "متابعة حقيقية");
extra("Le suivi s'affiche après 5 lots étiquetés à la DLC.", "Monitoring appears after 5 lots labeled at expiry.", "El seguimiento aparece tras 5 lotes etiquetados en la caducidad.", "Das Monitoring erscheint nach 5 zum Verfall etikettierten Losen.", "Il monitoraggio appare dopo 5 lotti etichettati alla scadenza.", "تظهر المتابعة بعد وسم 5 دفعات عند انتهاء الصلاحية.");
extra("Brier réel", "Real Brier", "Brier real", "Echter Brier", "Brier reale", "براير الحقيقي");
extra("Couverture réelle", "Real coverage", "Cobertura real", "Echte Abdeckung", "Copertura reale", "تغطية حقيقية");
extra("Lots étiquetés", "Labeled lots", "Lotes etiquetados", "Etikettierte Lose", "Lotti etichettati", "دفعات موسومة");
extra("Dérive", "Drift", "Deriva", "Drift", "Deriva", "انحراف");
extra("Veille renforcée", "Heightened watch", "Vigilancia reforzada", "Verstärkte Beobachtung", "Vigilanza rafforzata", "مراقبة مشددة");
extra("Réessayer", "Retry", "Reintentar", "Erneut versuchen", "Riprova", "إعادة المحاولة");
extra("Formule", "Formula", "Fórmula", "Formel", "Formula", "الصيغة");
extra("Entraînement", "Training", "Entrenamiento", "Training", "Addestramento", "التدريب");
extra("Validation", "Validation", "Validación", "Validierung", "Validazione", "التحقق");
extra("vers", "to", "hacia", "nach", "verso", "إلى");
extra("Rejeter", "Reject", "Rechazar", "Ablehnen", "Rifiuta", "رفض");
extra("Rejeté", "Rejected", "Rechazado", "Abgelehnt", "Rifiutato", "مرفوض");
extra("Rejeter le mouvement", "Reject movement", "Rechazar movimiento", "Bewegung ablehnen", "Rifiuta movimento", "رفض الحركة");
extra("Motif du rejet (optionnel)", "Rejection reason (optional)", "Motivo del rechazo (opcional)", "Ablehnungsgrund (optional)", "Motivo del rifiuto (facoltativo)", "سبب الرفض (اختياري)");
extra("Confirmer le rejet", "Confirm rejection", "Confirmar rechazo", "Ablehnung bestätigen", "Conferma rifiuto", "تأكيد الرفض");
extra("Mouvement validé.", "Movement validated.", "Movimiento validado.", "Bewegung bestätigt.", "Movimento convalidato.", "تم اعتماد الحركة.");
extra("Mouvement rejeté.", "Movement rejected.", "Movimiento rechazado.", "Bewegung abgelehnt.", "Movimento rifiutato.", "تم رفض الحركة.");
extra("Mouvement créé avec succès.", "Movement created.", "Movimiento creado.", "Bewegung erstellt.", "Movimento creato.", "تم إنشاء الحركة.");
extra(
  "Mouvement envoyé pour validation. Le stock ne change pas tant qu'il n'est pas validé.",
  "Movement sent for validation. Stock does not change until it is validated.",
  "Movimiento enviado para validación. El stock no cambia hasta que se valide.",
  "Bewegung zur Bestätigung gesendet. Der Bestand ändert sich erst nach der Bestätigung.",
  "Movimento inviato per convalida. Lo stock non cambia finché non è convalidato.",
  "أُرسلت الحركة للاعتماد. لا يتغير المخزون قبل اعتمادها."
);
extra(
  "Stock insuffisant. Le mouvement reste en attente.",
  "Insufficient stock. The movement stays pending.",
  "Stock insuficiente. El movimiento sigue pendiente.",
  "Bestand unzureichend. Die Bewegung bleibt ausstehend.",
  "Stock insufficiente. Il movimento resta in attesa.",
  "المخزون غير كافٍ. تبقى الحركة قيد الانتظار."
);
extra("Action non autorisée.", "Action not allowed.", "Acción no autorizada.", "Aktion nicht erlaubt.", "Azione non autorizzata.", "إجراء غير مسموح.");
extra("Mouvement introuvable.", "Movement not found.", "Movimiento no encontrado.", "Bewegung nicht gefunden.", "Movimento non trovato.", "الحركة غير موجودة.");
extra("Ce mouvement est déjà traité.", "This movement has already been processed.", "Este movimiento ya fue tratado.", "Diese Bewegung wurde bereits bearbeitet.", "Questo movimento è già stato trattato.", "سبقت معالجة هذه الحركة.");
extra(
  "Vous ne pouvez pas valider votre propre mouvement.",
  "You cannot validate your own movement.",
  "No puede validar su propio movimiento.",
  "Sie können Ihre eigene Bewegung nicht bestätigen.",
  "Non potete convalidare il vostro movimento.",
  "لا يمكنك اعتماد حركتك."
);
extra("Seuil de validation des mouvements (DT)", "Movement validation threshold (DT)", "Umbral de validación de movimientos (DT)", "Schwelle für Bewegungsbestätigung (DT)", "Soglia di convalida movimenti (DT)", "عتبة اعتماد الحركات (د.ت)");
extra("0 ou vide = validation désactivée", "0 or empty = validation disabled", "0 o vacío = validación desactivada", "0 oder leer = Bestätigung deaktiviert", "0 o vuoto = convalida disattivata", "0 أو فارغ = الاعتماد معطّل");
extra("Le seuil ne peut pas être négatif.", "The threshold cannot be negative.", "El umbral no puede ser negativo.", "Die Schwelle darf nicht negativ sein.", "La soglia non può essere negativa.", "لا يمكن أن تكون العتبة سالبة.");

export const APP_UI = packed.APP_UI;
export const APP_UI_PHRASES = packed.PHRASE_INDEX;
