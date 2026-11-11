import { CLIENT_UI } from "./clientUiLocales";
import { APP_UI } from "../../i18n/appUiLocales";
import { LANGUAGES, getStoredLang, storeLang } from "../../i18n/languages";

export { LANGUAGES, getStoredLang, storeLang };

export const SOCIAL_LINKS = [
  { id: "facebook", label: "Facebook", href: "https://www.facebook.com/" },
  { id: "x", label: "X", href: "https://x.com/" },
  { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/" },
  { id: "instagram", label: "Instagram", href: "https://www.instagram.com/" },
];

/** @type {Record<string, object>} */
export const DICTS = {
  fr: {
    email: "contact@stokify.app",
    hours: "Horaires : 8:00 – 19:45",
    hoursShort: "8:00 – 19:45",
    tagline: "Stock · Traçabilité · IA",
    home: "Accueil",
    about: "À propos",
    services: "Services",
    projects: "Aperçu",
    navDiscover: "Découvrir",
    navStats: "Faits techniques",
    navWhy: "Opérations exigeantes",
    navJourney: "Parcours stock",
    login: "Connexion",
    signup: "Créer un compte",
    lang: "Langue",
    follow: "Suivez-nous",
    menuOpen: "Ouvrir le menu",
    menuClose: "Fermer le menu",
    navCatalog: "Catalogue",
    navWishlist: "Favoris",
    navOrders: "Commandes",
    navProfile: "Profil",
    navCart: "Panier",
    navLogout: "Déconnexion",
    navClientSpace: "Espace client",
    loading: "Chargement…",

    heroSlides: [
      {
        id: "warehouse-v2",
        eyebrow: "Contrôle d’entrepôt intelligent",
        title: "Pilotez votre entrepôt avec Stokify",
        text: "Multi-société, multi-dépôt, traçabilité FEFO/FIFO et sécurité par rôles — une plateforme conçue pour les opérations réelles.",
      },
      {
        id: "dock-truck",
        eyebrow: "Port de dépôt & livraisons",
        title: "Du quai au stock, tout est synchronisé",
        text: "Réceptions, mouvements et sorties reliés au même système — pour un flux logistique clair et traçable.",
      },
      {
        id: "smart-ops",
        eyebrow: "Opérations intelligentes",
        title: "IA, robots et décisions terrain",
        text: "Prévision, anomalies et optimisation pour aider magasiniers et responsables au quotidien.",
      },
    ],
    heroLearnMore: "En savoir plus",
    heroSignupAria: "Créer un compte",
    heroSlidePrev: "Slide précédent",
    heroSlideNext: "Slide suivant",
    heroTrialTitle: "Essayez Stokify gratuitement",
    heroNamePlaceholder: "Votre nom",
    heroEmailPlaceholder: "Email*",
    heroTruckAlt: "Camion de livraison",

    features: [
      {
        title: "Multi-société & multi-dépôt",
        text: "Isolez les données par société et pilotez plusieurs dépôts depuis la même plateforme.",
      },
      {
        title: "Traçabilité FEFO/FIFO",
        text: "Suivez lots et mouvements selon FEFO ou FIFO pour des sorties de stock cohérentes.",
      },
      {
        title: "Sécurité par rôles",
        text: "Admin, responsable, magasinier, comptable et client : accès limité à chaque profil.",
      },
    ],
    featuresMagasinierAlt: "Magasinier Stokify avec diable",
    featuresStatus: "Opérationnel",
    featuresStatusHover: "Camion en route",

    modulesEyebrow: "Modules du système",
    modulesTitle: "Quatre piliers opérationnels",
    modulesDesc:
      "Stokify regroupe les modules métier réellement implémentés dans le projet — de l’achat à l’IA décisionnelle.",
    modulesImageAlt: "Rayonnages d’entrepôt — modules Stokify",
    modules: [
      {
        title: "Achats & réceptions",
        text: "Commandes fournisseurs, réceptions et mise à jour du stock dès l’entrée en dépôt.",
      },
      {
        title: "Ventes & facturation",
        text: "Parcours commercial jusqu’à la facturation, avec impact cohérent sur les stocks.",
      },
      {
        title: "Inventaire & écarts",
        text: "Campagnes d’inventaire, saisie terrain et visualisation des écarts pour corriger le stock.",
      },
      {
        title: "Module IA",
        text: "Prévision, détection d’anomalies et suggestions d’optimisation pour aider les décisions opérationnelles.",
      },
    ],

    statsEyebrow: "Architecture réelle",
    statsTitle: "Des faits techniques, pas des chiffres marketing",
    statsDesc:
      "Stokify est multi-société et multi-dépôt : chaque société isole ses données, et plusieurs dépôts peuvent être pilotés dans le même contexte opérationnel.",
    stats: [
      {
        value: "33",
        label: "Modules backend",
        detail: "Domaines métier et services exposés dans l’API Stokify",
      },
      {
        value: "4",
        label: "Méthodes de valorisation",
        detail: "CMP, FIFO, LIFO et dernier prix d’achat",
      },
      {
        value: "6",
        label: "Rôles utilisateurs",
        detail: "Super admin, admin, responsable, magasinier, comptable, client",
      },
    ],
    marquee: [
      "STOCK",
      "TRAÇABILITÉ",
      "IA",
      "SÉCURITÉ",
      "MULTI-SOCIÉTÉ",
      "MULTI-DÉPÔT",
      "FEFO",
      "FIFO",
    ],

    whyEyebrow: "Pourquoi Stokify",
    whyTitle: "Conçu pour des opérations de stock exigeantes",
    whyDesc:
      "Fonctionnalités, sécurité et architecture — le détail technique du projet, sans promesses commerciales inventées.",
    whyImageAlt: "Poste de pilotage — tableau de bord stock Stokify",
    whyTabs: [
      {
        id: "fonctionnalites",
        label: "Fonctionnalités",
        title: "Un parcours métier complet",
        points: [
          "Achats, réceptions, ventes et inventaires reliés au stock en temps réel.",
          "Gestion des lots, numéros de série et stratégies de sortie FEFO/FIFO.",
          "Module IA pour la prévision, les anomalies et l’optimisation opérationnelle.",
        ],
      },
      {
        id: "securite",
        label: "Sécurité",
        title: "Accès contrôlé par rôles",
        points: [
          "Six rôles distincts : super admin, admin, responsable, magasinier, comptable, client.",
          "Permissions déclarées côté UI et API (RBAC) pour limiter chaque action sensible.",
          "Contexte multi-société : les données restent isolées par société via le JWT.",
        ],
      },
      {
        id: "architecture",
        label: "Architecture technique",
        title: "Stack claire et modulaire",
        points: [
          "Frontend React 18 / Vite / Tailwind, backend Node organisé en modules métier.",
          "33 modules backend couvrant stock, commerce, valorisation, IA et administration.",
          "Valorisation multi-méthodes : CMP, FIFO, LIFO et dernier prix d’achat.",
        ],
      },
    ],

    showcaseEyebrow: "Aperçu produit",
    showcaseTitle: "L’interface Stokify en action",
    showcaseDesc:
      "Trois écrans représentatifs du produit — dashboard, IA et lots — à la place des galeries « projets » génériques.",
    showcases: [
      {
        title: "Dashboard principal",
        text: "Vue d’ensemble opérationnelle : indicateurs de stock, accès rapides et pilotage multi-dépôt.",
        alt: "Aperçu du dashboard Stokify",
      },
      {
        title: "Module IA",
        text: "Prévision, détection d’anomalies et pistes d’optimisation regroupées dans un hub dédié.",
        alt: "Aperçu du module IA Stokify",
      },
      {
        title: "Gestion des lots",
        text: "Suivi des lots, DLC et statuts pour une traçabilité FEFO/FIFO exploitable au quotidien.",
        alt: "Aperçu de la gestion des lots Stokify",
      },
    ],

    ctaEyebrow: "Prêt à tester",
    ctaTitle: "Explorez Stokify sur vos propres flux de stock",
    ctaDesc:
      "Plateforme multi-société et multi-dépôt avec traçabilité FEFO/FIFO, valorisation multi-méthodes et sécurité par rôles — conçue comme projet de fin d’études, pas comme vitrine commerciale fictive.",
    ctaLogin: "Se connecter",

    introTitle: "La gestion de stock, réinventée.",
    introSubtitle:
      "Stokify unifie inventaire, achats et logistique dans une plateforme intelligente.",
    introDiscover: "Découvrir Stokify",
    introExplore: "Explorer les fonctionnalités",
    introPlayVideo: "Lire la vidéo",
    introScrollHint: "Découvrir l'accueil",
    introChipAi: "IA intégrée",
    introChipMulti: "Multi-dépôts",
    introChipRealtime: "Temps réel",

    flowEyebrow: "Parcours du stock",
    flowTitle: "Du quai au pilotage, un flux unique",
    flowDesc:
      "Stokify relie réception, stockage, sorties FEFO/FIFO et indicateurs — le même parcours métier que vos équipes vivent sur le terrain.",
    flowTruckAlt: "Magasinier Stokify avec tablette Module IA",
    flowSteps: [
      {
        title: "Réception",
        text: "Commandes fournisseurs et mises à jour du stock dès l’entrée en dépôt.",
      },
      {
        title: "Stockage",
        text: "Lots, emplacements et multi-dépôt pour une vision claire de chaque article.",
      },
      {
        title: "Sorties FEFO/FIFO",
        text: "Mouvements et ventes alignés sur la stratégie de sortie choisie.",
      },
      {
        title: "Pilotage & IA",
        text: "Indicateurs, inventaires et suggestions pour décider plus vite.",
      },
    ],

    footerTagline:
      "Stokify — plateforme de gestion de stock multi-société / multi-dépôt, traçabilité et module IA. Projet de fin d’études.",
    footerNav: "Navigation",
    footerExplore: "Explorer",
    footerAccount: "Compte",
    footerContact: "Contact",
    footerFlow: "Parcours",
    footerFeatures: "Fonctionnalités",
    footerBackToTop: "Haut de page",
    footerSocialNote: "Actualités produit, démos et coulisses du projet Stokify.",
    footerCopyright: "© {year} Stokify — projet académique.",
  },

  en: {
    email: "contact@stokify.app",
    hours: "Hours: 8:00 AM – 7:45 PM",
    hoursShort: "8:00 – 19:45",
    tagline: "Stock · Traceability · AI",
    home: "Home",
    about: "About",
    services: "Services",
    projects: "Projects",
    navDiscover: "Explore",
    navStats: "Technical facts",
    navWhy: "Demanding operations",
    navJourney: "Stock journey",
    login: "Login",
    signup: "Sign Up",
    lang: "Language",
    follow: "Follow us",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    navCatalog: "Catalog",
    navWishlist: "Wishlist",
    navOrders: "Orders",
    navProfile: "Profile",
    navCart: "Cart",
    navLogout: "Log out",
    navClientSpace: "Client area",
    loading: "Loading…",

    heroSlides: [
      {
        id: "warehouse-v2",
        eyebrow: "Smart Warehouse Control",
        title: "Run your warehouse with Stokify",
        text: "Multi-company, multi-warehouse, FEFO/FIFO traceability and role-based security — built for real operations.",
      },
      {
        id: "dock-truck",
        eyebrow: "Dock & deliveries",
        title: "From dock to stock, fully synced",
        text: "Receipts, movements and outbound flows in one system — clear, traceable logistics.",
      },
      {
        id: "smart-ops",
        eyebrow: "Smart operations",
        title: "AI, robots and floor decisions",
        text: "Forecasting, anomalies and optimization to help warehouse staff and managers every day.",
      },
    ],
    heroLearnMore: "Learn more",
    heroSignupAria: "Create an account",
    heroSlidePrev: "Previous slide",
    heroSlideNext: "Next slide",
    heroTrialTitle: "Try Stokify for free",
    heroNamePlaceholder: "Your name",
    heroEmailPlaceholder: "Email*",
    heroTruckAlt: "Delivery truck",

    features: [
      {
        title: "Multi-company & multi-warehouse",
        text: "Isolate data by company and run several warehouses from one platform.",
      },
      {
        title: "FEFO/FIFO traceability",
        text: "Track lots and movements with FEFO or FIFO for consistent stock outbound.",
      },
      {
        title: "Role-based security",
        text: "Admin, manager, warehouse clerk, accountant and client: access limited per profile.",
      },
    ],
    featuresMagasinierAlt: "Stokify warehouse worker with hand truck",
    featuresStatus: "Operational",
    featuresStatusHover: "Truck on the move",

    modulesEyebrow: "System modules",
    modulesTitle: "Four operational pillars",
    modulesDesc:
      "Stokify brings together the business modules actually built in the project — from purchasing to decision AI.",
    modulesImageAlt: "Warehouse racking — Stokify modules",
    modules: [
      {
        title: "Purchasing & receipts",
        text: "Supplier orders, receipts and stock updates as soon as goods enter the warehouse.",
      },
      {
        title: "Sales & invoicing",
        text: "Commercial flow through invoicing, with consistent impact on stock levels.",
      },
      {
        title: "Inventory & variances",
        text: "Inventory campaigns, floor entry and variance views to correct stock.",
      },
      {
        title: "AI module",
        text: "Forecasting, anomaly detection and optimization suggestions for operational decisions.",
      },
    ],

    statsEyebrow: "Real architecture",
    statsTitle: "Technical facts, not marketing numbers",
    statsDesc:
      "Stokify is multi-company and multi-warehouse: each company isolates its data, and several warehouses can run in the same operational context.",
    stats: [
      {
        value: "33",
        label: "Backend modules",
        detail: "Business domains and services exposed in the Stokify API",
      },
      {
        value: "4",
        label: "Valuation methods",
        detail: "WAC, FIFO, LIFO and last purchase price",
      },
      {
        value: "6",
        label: "User roles",
        detail: "Super admin, admin, manager, warehouse clerk, accountant, client",
      },
    ],
    marquee: [
      "STOCK",
      "TRACEABILITY",
      "AI",
      "SECURITY",
      "MULTI-COMPANY",
      "MULTI-WAREHOUSE",
      "FEFO",
      "FIFO",
    ],

    whyEyebrow: "Why Stokify",
    whyTitle: "Built for demanding stock operations",
    whyDesc:
      "Features, security and architecture — the project’s real technical detail, without invented commercial claims.",
    whyImageAlt: "Control desk — Stokify stock dashboard",
    whyTabs: [
      {
        id: "fonctionnalites",
        label: "Features",
        title: "A complete business journey",
        points: [
          "Purchasing, receipts, sales and inventories linked to stock in real time.",
          "Lot management, serial numbers and FEFO/FIFO outbound strategies.",
          "AI module for forecasting, anomalies and operational optimization.",
        ],
      },
      {
        id: "securite",
        label: "Security",
        title: "Role-controlled access",
        points: [
          "Six distinct roles: super admin, admin, manager, warehouse clerk, accountant, client.",
          "Permissions declared on UI and API (RBAC) to limit every sensitive action.",
          "Multi-company context: data stays isolated per company via JWT.",
        ],
      },
      {
        id: "architecture",
        label: "Technical architecture",
        title: "Clear, modular stack",
        points: [
          "React 18 / Vite / Tailwind frontend, Node backend organized by business modules.",
          "33 backend modules covering stock, commerce, valuation, AI and administration.",
          "Multi-method valuation: WAC, FIFO, LIFO and last purchase price.",
        ],
      },
    ],

    showcaseEyebrow: "Product preview",
    showcaseTitle: "The Stokify interface in action",
    showcaseDesc:
      "Three representative screens — dashboard, AI and lots — instead of generic project galleries.",
    showcases: [
      {
        title: "Main dashboard",
        text: "Operational overview: stock KPIs, quick access and multi-warehouse control.",
        alt: "Stokify dashboard preview",
      },
      {
        title: "AI module",
        text: "Forecasting, anomaly detection and optimization ideas in a dedicated hub.",
        alt: "Stokify AI module preview",
      },
      {
        title: "Lot management",
        text: "Lot tracking, expiry dates and statuses for everyday FEFO/FIFO traceability.",
        alt: "Stokify lot management preview",
      },
    ],

    ctaEyebrow: "Ready to try",
    ctaTitle: "Explore Stokify on your own stock flows",
    ctaDesc:
      "Multi-company and multi-warehouse platform with FEFO/FIFO traceability, multi-method valuation and role-based security — built as a graduation project, not a fake marketing showcase.",
    ctaLogin: "Sign in",

    introTitle: "Inventory management, reinvented.",
    introSubtitle:
      "Stokify unifies inventory, purchasing and logistics in one intelligent platform.",
    introDiscover: "Discover Stokify",
    introExplore: "Explore features",
    introPlayVideo: "Play video",
    introScrollHint: "Discover home",
    introChipAi: "Built-in AI",
    introChipMulti: "Multi-warehouse",
    introChipRealtime: "Real-time",

    flowEyebrow: "Stock journey",
    flowTitle: "From dock to decision, one continuous flow",
    flowDesc:
      "Stokify connects receiving, storage, FEFO/FIFO outbound moves and KPIs — the same operational path your teams run on the floor.",
    flowTruckAlt: "Stokify warehouse worker with AI Module tablet",
    flowSteps: [
      {
        title: "Receiving",
        text: "Supplier orders and stock updates as soon as goods enter the warehouse.",
      },
      {
        title: "Storage",
        text: "Lots, locations and multi-warehouse views for every article.",
      },
      {
        title: "FEFO/FIFO outbound",
        text: "Movements and sales aligned with your chosen issue strategy.",
      },
      {
        title: "Steering & AI",
        text: "Indicators, inventories and suggestions to decide faster.",
      },
    ],

    footerTagline:
      "Stokify — multi-company / multi-warehouse stock platform with traceability and AI. Graduation project.",
    footerNav: "Navigation",
    footerExplore: "Explore",
    footerAccount: "Account",
    footerContact: "Contact",
    footerFlow: "Journey",
    footerFeatures: "Features",
    footerBackToTop: "Back to top",
    footerSocialNote: "Product updates, demos, and behind the scenes of the Stokify project.",
    footerCopyright: "© {year} Stokify — academic project.",
  },

  es: {
    email: "contact@stokify.app",
    hours: "Horario: 8:00 – 19:45",
    hoursShort: "8:00 – 19:45",
    tagline: "Stock · Trazabilidad · IA",
    home: "Inicio",
    about: "Nosotros",
    services: "Servicios",
    projects: "Proyectos",
    navDiscover: "Explorar",
    navStats: "Hechos técnicos",
    navWhy: "Operaciones exigentes",
    navJourney: "Recorrido stock",
    login: "Iniciar sesión",
    signup: "Registrarse",
    lang: "Idioma",
    follow: "Síguenos",
    menuOpen: "Abrir menú",
    menuClose: "Cerrar menú",
    navCatalog: "Catálogo",
    navWishlist: "Favoritos",
    navOrders: "Pedidos",
    navProfile: "Perfil",
    navCart: "Carrito",
    navLogout: "Cerrar sesión",
    navClientSpace: "Espacio cliente",
    loading: "Cargando…",
    heroSlides: [
      {
        id: "warehouse-v2",
        eyebrow: "Control inteligente de almacén",
        title: "Gestiona tu almacén con Stokify",
        text: "Multi-empresa, multi-almacén, trazabilidad FEFO/FIFO y seguridad por roles — pensado para operaciones reales.",
      },
      {
        id: "dock-truck",
        eyebrow: "Muelle y entregas",
        title: "Del muelle al stock, todo sincronizado",
        text: "Recepciones, movimientos y salidas en un mismo sistema — logística clara y trazable.",
      },
      {
        id: "smart-ops",
        eyebrow: "Operaciones inteligentes",
        title: "IA, robots y decisiones en planta",
        text: "Previsión, anomalías y optimización para ayudar a almaceneros y responsables cada día.",
      },
    ],
    heroLearnMore: "Saber más",
    heroSignupAria: "Crear una cuenta",
    heroSlidePrev: "Diapositiva anterior",
    heroSlideNext: "Diapositiva siguiente",
    heroTrialTitle: "Prueba Stokify gratis",
    heroNamePlaceholder: "Tu nombre",
    heroEmailPlaceholder: "Email*",
    heroTruckAlt: "Camión de entrega",
    features: [
      {
        title: "Multi-empresa y multi-almacén",
        text: "Aísla los datos por empresa y gestiona varios almacenes desde la misma plataforma.",
      },
      {
        title: "Trazabilidad FEFO/FIFO",
        text: "Sigue lotes y movimientos con FEFO o FIFO para salidas de stock coherentes.",
      },
      {
        title: "Seguridad por roles",
        text: "Admin, responsable, almacenero, contable y cliente: acceso limitado por perfil.",
      },
    ],
    featuresMagasinierAlt: "Almacenero Stokify con diablo",
    featuresStatus: "Operativo",
    featuresStatusHover: "Camión en ruta",
    modulesEyebrow: "Módulos del sistema",
    modulesTitle: "Cuatro pilares operativos",
    modulesDesc:
      "Stokify agrupa los módulos de negocio realmente implementados — de compras a IA decisional.",
    modulesImageAlt: "Estanterías de almacén — módulos Stokify",
    modules: [
      {
        title: "Compras y recepciones",
        text: "Pedidos a proveedores, recepciones y actualización de stock al entrar en almacén.",
      },
      {
        title: "Ventas y facturación",
        text: "Flujo comercial hasta la facturación, con impacto coherente en el stock.",
      },
      {
        title: "Inventario y desviaciones",
        text: "Campañas de inventario, captura en planta y visualización de diferencias.",
      },
      {
        title: "Módulo IA",
        text: "Previsión, detección de anomalías y sugerencias de optimización operativa.",
      },
    ],
    statsEyebrow: "Arquitectura real",
    statsTitle: "Hechos técnicos, no cifras de marketing",
    statsDesc:
      "Stokify es multi-empresa y multi-almacén: cada empresa aísla sus datos y varios almacenes pueden operarse en el mismo contexto.",
    stats: [
      {
        value: "33",
        label: "Módulos backend",
        detail: "Dominios de negocio y servicios expuestos en la API Stokify",
      },
      {
        value: "4",
        label: "Métodos de valoración",
        detail: "CMP, FIFO, LIFO y último precio de compra",
      },
      {
        value: "6",
        label: "Roles de usuario",
        detail: "Super admin, admin, responsable, almacenero, contable, cliente",
      },
    ],
    marquee: [
      "STOCK",
      "TRAZABILIDAD",
      "IA",
      "SEGURIDAD",
      "MULTI-EMPRESA",
      "MULTI-ALMACÉN",
      "FEFO",
      "FIFO",
    ],
    whyEyebrow: "Por qué Stokify",
    whyTitle: "Diseñado para operaciones de stock exigentes",
    whyDesc:
      "Funciones, seguridad y arquitectura — el detalle técnico real del proyecto, sin promesas comerciales inventadas.",
    whyImageAlt: "Puesto de control — panel de stock Stokify",
    whyTabs: [
      {
        id: "fonctionnalites",
        label: "Funciones",
        title: "Un recorrido de negocio completo",
        points: [
          "Compras, recepciones, ventas e inventarios ligados al stock en tiempo real.",
          "Gestión de lotes, números de serie y estrategias FEFO/FIFO.",
          "Módulo IA para previsión, anomalías y optimización operativa.",
        ],
      },
      {
        id: "securite",
        label: "Seguridad",
        title: "Acceso controlado por roles",
        points: [
          "Seis roles: super admin, admin, responsable, almacenero, contable, cliente.",
          "Permisos declarados en UI y API (RBAC) para limitar cada acción sensible.",
          "Contexto multi-empresa: los datos se aíslan por empresa vía JWT.",
        ],
      },
      {
        id: "architecture",
        label: "Arquitectura técnica",
        title: "Stack claro y modular",
        points: [
          "Frontend React 18 / Vite / Tailwind, backend Node por módulos de negocio.",
          "33 módulos backend: stock, comercio, valoración, IA y administración.",
          "Valoración multi-método: CMP, FIFO, LIFO y último precio de compra.",
        ],
      },
    ],
    showcaseEyebrow: "Vista del producto",
    showcaseTitle: "La interfaz Stokify en acción",
    showcaseDesc:
      "Tres pantallas representativas — dashboard, IA y lotes — en lugar de galerías genéricas.",
    showcases: [
      {
        title: "Dashboard principal",
        text: "Visión operativa: indicadores de stock, accesos rápidos y control multi-almacén.",
        alt: "Vista del dashboard Stokify",
      },
      {
        title: "Módulo IA",
        text: "Previsión, anomalías y optimización en un hub dedicado.",
        alt: "Vista del módulo IA Stokify",
      },
      {
        title: "Gestión de lotes",
        text: "Seguimiento de lotes, caducidad y estados para trazabilidad FEFO/FIFO diaria.",
        alt: "Vista de gestión de lotes Stokify",
      },
    ],
    ctaEyebrow: "Listo para probar",
    ctaTitle: "Explora Stokify en tus propios flujos de stock",
    ctaDesc:
      "Plataforma multi-empresa y multi-almacén con trazabilidad FEFO/FIFO, valoración multi-método y seguridad por roles — proyecto de fin de estudios, no un escaparate ficticio.",
    ctaLogin: "Iniciar sesión",

    introTitle: "La gestión de stock, reinventada.",
    introSubtitle:
      "Stokify unifica inventario, compras y logística en una plataforma inteligente.",
    introDiscover: "Descubrir Stokify",
    introExplore: "Explorar funcionalidades",
    introPlayVideo: "Reproducir vídeo",
    introScrollHint: "Descubrir inicio",
    introChipAi: "IA integrada",
    introChipMulti: "Multi-almacén",
    introChipRealtime: "Tiempo real",

    flowEyebrow: "Recorrido del stock",
    flowTitle: "Del muelle al control, un solo flujo",
    flowDesc:
      "Stokify conecta recepción, almacenamiento, salidas FEFO/FIFO e indicadores — el mismo recorrido operativo de tus equipos.",
    flowTruckAlt: "Almacenista Stokify con tablet Módulo IA",
    flowSteps: [
      {
        title: "Recepción",
        text: "Pedidos a proveedores y actualización del stock al entrar en almacén.",
      },
      {
        title: "Almacenamiento",
        text: "Lotes, ubicaciones y multi-almacén para ver cada artículo con claridad.",
      },
      {
        title: "Salidas FEFO/FIFO",
        text: "Movimientos y ventas alineados con la estrategia de salida elegida.",
      },
      {
        title: "Control e IA",
        text: "Indicadores, inventarios y sugerencias para decidir más rápido.",
      },
    ],

    footerTagline:
      "Stokify — plataforma de stock multi-empresa / multi-almacén, trazabilidad e IA. Proyecto académico.",
    footerNav: "Navegación",
    footerExplore: "Explorar",
    footerAccount: "Cuenta",
    footerContact: "Contacto",
    footerFlow: "Recorrido",
    footerFeatures: "Funciones",
    footerBackToTop: "Volver arriba",
    footerSocialNote: "Novedades del producto, demos y bastidores del proyecto Stokify.",
    footerCopyright: "© {year} Stokify — proyecto académico.",
  },

  de: {
    email: "contact@stokify.app",
    hours: "Öffnungszeiten: 8:00 – 19:45",
    hoursShort: "8:00 – 19:45",
    tagline: "Lager · Rückverfolgbarkeit · KI",
    home: "Start",
    about: "Über uns",
    services: "Leistungen",
    projects: "Projekte",
    navDiscover: "Entdecken",
    navStats: "Technische Fakten",
    navWhy: "Anspruchsvolle Abläufe",
    navJourney: "Bestandsfluss",
    login: "Anmelden",
    signup: "Registrieren",
    lang: "Sprache",
    follow: "Folgen Sie uns",
    menuOpen: "Menü öffnen",
    menuClose: "Menü schließen",
    navCatalog: "Katalog",
    navWishlist: "Favoriten",
    navOrders: "Bestellungen",
    navProfile: "Profil",
    navCart: "Warenkorb",
    navLogout: "Abmelden",
    navClientSpace: "Kundenbereich",
    loading: "Laden…",
    heroSlides: [
      {
        id: "warehouse-v2",
        eyebrow: "Intelligente Lagersteuerung",
        title: "Steuern Sie Ihr Lager mit Stokify",
        text: "Multi-Unternehmen, Multi-Lager, FEFO/FIFO-Rückverfolgbarkeit und rollenbasierte Sicherheit — für echte Abläufe.",
      },
      {
        id: "dock-truck",
        eyebrow: "Rampe & Lieferungen",
        title: "Vom Dock zum Bestand — synchron",
        text: "Wareneingänge, Bewegungen und Ausgänge in einem System — klar und nachvollziehbar.",
      },
      {
        id: "smart-ops",
        eyebrow: "Intelligente Operationen",
        title: "KI, Roboter und Entscheidungen vor Ort",
        text: "Prognose, Anomalien und Optimierung für Lageristen und Verantwortliche im Alltag.",
      },
    ],
    heroLearnMore: "Mehr erfahren",
    heroSignupAria: "Konto erstellen",
    heroSlidePrev: "Vorherige Folie",
    heroSlideNext: "Nächste Folie",
    heroTrialTitle: "Stokify kostenlos testen",
    heroNamePlaceholder: "Ihr Name",
    heroEmailPlaceholder: "E-Mail*",
    heroTruckAlt: "Lieferwagen",
    features: [
      {
        title: "Multi-Unternehmen & Multi-Lager",
        text: "Daten je Unternehmen isolieren und mehrere Lager auf einer Plattform steuern.",
      },
      {
        title: "FEFO/FIFO-Rückverfolgbarkeit",
        text: "Chargen und Bewegungen nach FEFO oder FIFO für konsistente Ausgänge verfolgen.",
      },
      {
        title: "Rollenbasierte Sicherheit",
        text: "Admin, Verantwortlicher, Lagerist, Buchhalter und Kunde: Zugriff je Profil begrenzt.",
      },
    ],
    featuresMagasinierAlt: "Stokify-Lagerist mit Hubwagen",
    featuresStatus: "Betriebsbereit",
    featuresStatusHover: "LKW unterwegs",
    modulesEyebrow: "Systemmodule",
    modulesTitle: "Vier operative Säulen",
    modulesDesc:
      "Stokify bündelt die tatsächlich umgesetzten Fachmodule — vom Einkauf bis zur Entscheidungs-KI.",
    modulesImageAlt: "Lagerregale — Stokify-Module",
    modules: [
      {
        title: "Einkauf & Wareneingang",
        text: "Lieferantenbestellungen, Wareneingänge und Bestandsaktualisierung beim Eingang.",
      },
      {
        title: "Verkauf & Fakturation",
        text: "Verkaufsprozess bis zur Rechnung mit konsistentem Bestandseinfluss.",
      },
      {
        title: "Inventur & Abweichungen",
        text: "Inventurkampagnen, Erfassung vor Ort und Visualisierung von Differenzen.",
      },
      {
        title: "KI-Modul",
        text: "Prognose, Anomalieerkennung und Optimierungsvorschläge für operative Entscheidungen.",
      },
    ],
    statsEyebrow: "Echte Architektur",
    statsTitle: "Technische Fakten, keine Marketingzahlen",
    statsDesc:
      "Stokify ist Multi-Unternehmen und Multi-Lager: jedes Unternehmen isoliert seine Daten, mehrere Lager laufen im gleichen Kontext.",
    stats: [
      {
        value: "33",
        label: "Backend-Module",
        detail: "Fachdomänen und Dienste in der Stokify-API",
      },
      {
        value: "4",
        label: "Bewertungsmethoden",
        detail: "Gleitender Durchschnitt, FIFO, LIFO und letzter Einkaufspreis",
      },
      {
        value: "6",
        label: "Benutzerrollen",
        detail: "Super-Admin, Admin, Verantwortlicher, Lagerist, Buchhalter, Kunde",
      },
    ],
    marquee: [
      "BESTAND",
      "RÜCKVERFOLGBARKEIT",
      "KI",
      "SICHERHEIT",
      "MULTI-UNTERNEHMEN",
      "MULTI-LAGER",
      "FEFO",
      "FIFO",
    ],
    whyEyebrow: "Warum Stokify",
    whyTitle: "Für anspruchsvolle Bestandsprozesse",
    whyDesc:
      "Funktionen, Sicherheit und Architektur — echte Projektdetails, ohne erfundene Marketingversprechen.",
    whyImageAlt: "Leitstand — Stokify-Bestandsdashboard",
    whyTabs: [
      {
        id: "fonctionnalites",
        label: "Funktionen",
        title: "Ein vollständiger Geschäftsprozess",
        points: [
          "Einkauf, Wareneingang, Verkauf und Inventur in Echtzeit mit dem Bestand verknüpft.",
          "Chargen, Seriennummern und FEFO/FIFO-Ausgangsstrategien.",
          "KI-Modul für Prognose, Anomalien und Optimierung.",
        ],
      },
      {
        id: "securite",
        label: "Sicherheit",
        title: "Zugriff über Rollen gesteuert",
        points: [
          "Sechs Rollen: Super-Admin, Admin, Verantwortlicher, Lagerist, Buchhalter, Kunde.",
          "Berechtigungen in UI und API (RBAC) für sensible Aktionen.",
          "Multi-Unternehmen: Datenisolation je Unternehmen über JWT.",
        ],
      },
      {
        id: "architecture",
        label: "Technische Architektur",
        title: "Klarer, modularer Stack",
        points: [
          "Frontend React 18 / Vite / Tailwind, Backend Node nach Fachmodulen.",
          "33 Backend-Module: Bestand, Handel, Bewertung, KI und Administration.",
          "Mehrere Bewertungsmethoden: Durchschnitt, FIFO, LIFO, letzter Einkaufspreis.",
        ],
      },
    ],
    showcaseEyebrow: "Produktvorschau",
    showcaseTitle: "Die Stokify-Oberfläche in Aktion",
    showcaseDesc:
      "Drei typische Bildschirme — Dashboard, KI und Chargen — statt generischer Projektgalerien.",
    showcases: [
      {
        title: "Hauptdashboard",
        text: "Operativer Überblick: Bestandskennzahlen, Schnellzugriff und Multi-Lager-Steuerung.",
        alt: "Vorschau Stokify-Dashboard",
      },
      {
        title: "KI-Modul",
        text: "Prognose, Anomalien und Optimierungsideen in einem eigenen Hub.",
        alt: "Vorschau Stokify-KI-Modul",
      },
      {
        title: "Chargenverwaltung",
        text: "Chargen, MHD und Status für tägliche FEFO/FIFO-Rückverfolgbarkeit.",
        alt: "Vorschau Chargenverwaltung Stokify",
      },
    ],
    ctaEyebrow: "Bereit zum Testen",
    ctaTitle: "Entdecken Sie Stokify mit Ihren Bestandsflüssen",
    ctaDesc:
      "Multi-Unternehmen- und Multi-Lager-Plattform mit FEFO/FIFO, Mehrfachbewertung und Rollensicherheit — als Abschlussprojekt, nicht als Fake-Schaufenster.",
    ctaLogin: "Anmelden",

    introTitle: "Bestandsmanagement, neu erfunden.",
    introSubtitle:
      "Stokify vereint Inventar, Einkauf und Logistik in einer intelligenten Plattform.",
    introDiscover: "Stokify entdecken",
    introExplore: "Funktionen erkunden",
    introPlayVideo: "Video abspielen",
    introScrollHint: "Startseite entdecken",
    introChipAi: "Integrierte KI",
    introChipMulti: "Multi-Lager",
    introChipRealtime: "Echtzeit",

    flowEyebrow: "Bestandsfluss",
    flowTitle: "Vom Tor zur Steuerung — ein durchgängiger Fluss",
    flowDesc:
      "Stokify verbindet Wareneingang, Lagerung, FEFO/FIFO-Ausgänge und Kennzahlen — denselben Betriebspfad wie Ihre Teams vor Ort.",
    flowTruckAlt: "Stokify-Lagermitarbeiter mit KI-Modul-Tablet",
    flowSteps: [
      {
        title: "Wareneingang",
        text: "Lieferantenbestellungen und Bestandsaktualisierung beim Einlagern.",
      },
      {
        title: "Lagerung",
        text: "Lose, Lagerplätze und Multi-Lager für klare Artikelübersicht.",
      },
      {
        title: "FEFO/FIFO-Ausgänge",
        text: "Bewegungen und Verkäufe gemäß gewählter Auslagerungsstrategie.",
      },
      {
        title: "Steuerung & KI",
        text: "Kennzahlen, Inventuren und Vorschläge für schnellere Entscheidungen.",
      },
    ],

    footerTagline:
      "Stokify — Multi-Unternehmen-/Multi-Lager-Plattform mit Rückverfolgbarkeit und KI. Akademisches Projekt.",
    footerNav: "Navigation",
    footerExplore: "Entdecken",
    footerAccount: "Konto",
    footerContact: "Kontakt",
    footerFlow: "Ablauf",
    footerFeatures: "Funktionen",
    footerBackToTop: "Nach oben",
    footerSocialNote: "Produktnews, Demos und Einblicke hinter die Kulissen von Stokify.",
    footerCopyright: "© {year} Stokify — akademisches Projekt.",
  },

  it: {
    email: "contact@stokify.app",
    hours: "Orari: 8:00 – 19:45",
    hoursShort: "8:00 – 19:45",
    tagline: "Stock · Tracciabilità · IA",
    home: "Home",
    about: "Chi siamo",
    services: "Servizi",
    projects: "Progetti",
    navDiscover: "Esplora",
    navStats: "Fatti tecnici",
    navWhy: "Operazioni esigenti",
    navJourney: "Percorso stock",
    login: "Accedi",
    signup: "Registrati",
    lang: "Lingua",
    follow: "Seguici",
    menuOpen: "Apri menu",
    menuClose: "Chiudi menu",
    navCatalog: "Catalogo",
    navWishlist: "Preferiti",
    navOrders: "Ordini",
    navProfile: "Profilo",
    navCart: "Carrello",
    navLogout: "Esci",
    navClientSpace: "Area cliente",
    loading: "Caricamento…",
    heroSlides: [
      {
        id: "warehouse-v2",
        eyebrow: "Controllo magazzino intelligente",
        title: "Gestisci il magazzino con Stokify",
        text: "Multi-azienda, multi-deposito, tracciabilità FEFO/FIFO e sicurezza per ruoli — pensato per operazioni reali.",
      },
      {
        id: "dock-truck",
        eyebrow: "Banchina e consegne",
        title: "Dal molo allo stock, tutto sincronizzato",
        text: "Ricezioni, movimenti e uscite nello stesso sistema — logistica chiara e tracciabile.",
      },
      {
        id: "smart-ops",
        eyebrow: "Operazioni intelligenti",
        title: "IA, robot e decisioni sul campo",
        text: "Previsione, anomalie e ottimizzazione per magazzinieri e responsabili ogni giorno.",
      },
    ],
    heroLearnMore: "Scopri di più",
    heroSignupAria: "Crea un account",
    heroSlidePrev: "Slide precedente",
    heroSlideNext: "Slide successiva",
    heroTrialTitle: "Prova Stokify gratis",
    heroNamePlaceholder: "Il tuo nome",
    heroEmailPlaceholder: "Email*",
    heroTruckAlt: "Camion di consegna",
    features: [
      {
        title: "Multi-azienda e multi-deposito",
        text: "Isola i dati per azienda e gestisci più depositi dalla stessa piattaforma.",
      },
      {
        title: "Tracciabilità FEFO/FIFO",
        text: "Segui lotti e movimenti con FEFO o FIFO per uscite di stock coerenti.",
      },
      {
        title: "Sicurezza per ruoli",
        text: "Admin, responsabile, magazziniere, contabile e cliente: accesso limitato per profilo.",
      },
    ],
    featuresMagasinierAlt: "Magazziniere Stokify con transpallet",
    featuresStatus: "Operativo",
    featuresStatusHover: "Camion in viaggio",
    modulesEyebrow: "Moduli del sistema",
    modulesTitle: "Quattro pilastri operativi",
    modulesDesc:
      "Stokify riunisce i moduli business realmente implementati — dagli acquisti all’IA decisionale.",
    modulesImageAlt: "Scaffalature magazzino — moduli Stokify",
    modules: [
      {
        title: "Acquisti e ricezioni",
        text: "Ordini fornitori, ricezioni e aggiornamento stock all’ingresso in deposito.",
      },
      {
        title: "Vendite e fatturazione",
        text: "Percorso commerciale fino alla fattura, con impatto coerente sullo stock.",
      },
      {
        title: "Inventario e scostamenti",
        text: "Campagne di inventario, inserimento sul campo e visualizzazione degli scostamenti.",
      },
      {
        title: "Modulo IA",
        text: "Previsione, anomalie e suggerimenti di ottimizzazione per le decisioni operative.",
      },
    ],
    statsEyebrow: "Architettura reale",
    statsTitle: "Fatti tecnici, non numeri di marketing",
    statsDesc:
      "Stokify è multi-azienda e multi-deposito: ogni società isola i dati e più depositi possono operare nello stesso contesto.",
    stats: [
      {
        value: "33",
        label: "Moduli backend",
        detail: "Domini business e servizi esposti nell’API Stokify",
      },
      {
        value: "4",
        label: "Metodi di valorizzazione",
        detail: "CMP, FIFO, LIFO e ultimo prezzo d’acquisto",
      },
      {
        value: "6",
        label: "Ruoli utente",
        detail: "Super admin, admin, responsabile, magazziniere, contabile, cliente",
      },
    ],
    marquee: [
      "STOCK",
      "TRACCIABILITÀ",
      "IA",
      "SICUREZZA",
      "MULTI-AZIENDA",
      "MULTI-DEPOSITO",
      "FEFO",
      "FIFO",
    ],
    whyEyebrow: "Perché Stokify",
    whyTitle: "Progettato per operazioni di stock esigenti",
    whyDesc:
      "Funzionalità, sicurezza e architettura — il dettaglio tecnico reale del progetto, senza promesse commerciali inventate.",
    whyImageAlt: "Postazione di controllo — dashboard stock Stokify",
    whyTabs: [
      {
        id: "fonctionnalites",
        label: "Funzionalità",
        title: "Un percorso business completo",
        points: [
          "Acquisti, ricezioni, vendite e inventari collegati allo stock in tempo reale.",
          "Gestione lotti, numeri di serie e strategie di uscita FEFO/FIFO.",
          "Modulo IA per previsione, anomalie e ottimizzazione operativa.",
        ],
      },
      {
        id: "securite",
        label: "Sicurezza",
        title: "Accesso controllato per ruoli",
        points: [
          "Sei ruoli: super admin, admin, responsabile, magazziniere, contabile, cliente.",
          "Permessi dichiarati su UI e API (RBAC) per limitare ogni azione sensibile.",
          "Contesto multi-azienda: dati isolati per società via JWT.",
        ],
      },
      {
        id: "architecture",
        label: "Architettura tecnica",
        title: "Stack chiaro e modulare",
        points: [
          "Frontend React 18 / Vite / Tailwind, backend Node organizzato per moduli business.",
          "33 moduli backend: stock, commercio, valorizzazione, IA e amministrazione.",
          "Valorizzazione multi-metodo: CMP, FIFO, LIFO e ultimo prezzo d’acquisto.",
        ],
      },
    ],
    showcaseEyebrow: "Anteprima prodotto",
    showcaseTitle: "L’interfaccia Stokify in azione",
    showcaseDesc:
      "Tre schermate rappresentative — dashboard, IA e lotti — al posto di gallerie generiche.",
    showcases: [
      {
        title: "Dashboard principale",
        text: "Panoramica operativa: indicatori di stock, accessi rapidi e controllo multi-deposito.",
        alt: "Anteprima dashboard Stokify",
      },
      {
        title: "Modulo IA",
        text: "Previsione, anomalie e ottimizzazione in un hub dedicato.",
        alt: "Anteprima modulo IA Stokify",
      },
      {
        title: "Gestione lotti",
        text: "Monitoraggio lotti, scadenze e stati per la tracciabilità FEFO/FIFO quotidiana.",
        alt: "Anteprima gestione lotti Stokify",
      },
    ],
    ctaEyebrow: "Pronto a provare",
    ctaTitle: "Esplora Stokify sui tuoi flussi di stock",
    ctaDesc:
      "Piattaforma multi-azienda e multi-deposito con tracciabilità FEFO/FIFO, valorizzazione multi-metodo e sicurezza per ruoli — progetto di laurea, non una vetrina fittizia.",
    ctaLogin: "Accedi",

    introTitle: "La gestione dello stock, reinventata.",
    introSubtitle:
      "Stokify unifica inventario, acquisti e logistica in una piattaforma intelligente.",
    introDiscover: "Scopri Stokify",
    introExplore: "Esplora le funzionalità",
    introPlayVideo: "Riproduci video",
    introScrollHint: "Scopri home",
    introChipAi: "IA integrata",
    introChipMulti: "Multi-magazzino",
    introChipRealtime: "Tempo reale",

    flowEyebrow: "Percorso dello stock",
    flowTitle: "Dal molo al controllo, un unico flusso",
    flowDesc:
      "Stokify collega ricezione, stoccaggio, uscite FEFO/FIFO e indicatori — lo stesso percorso operativo dei tuoi team sul campo.",
    flowTruckAlt: "Magazziniere Stokify con tablet Modulo IA",
    flowSteps: [
      {
        title: "Ricezione",
        text: "Ordini fornitori e aggiornamento dello stock all’ingresso in deposito.",
      },
      {
        title: "Stoccaggio",
        text: "Lotti, ubicazioni e multi-deposito per una visione chiara di ogni articolo.",
      },
      {
        title: "Uscite FEFO/FIFO",
        text: "Movimenti e vendite allineati alla strategia di uscita scelta.",
      },
      {
        title: "Controllo e IA",
        text: "Indicatori, inventari e suggerimenti per decidere più in fretta.",
      },
    ],

    footerTagline:
      "Stokify — piattaforma stock multi-azienda / multi-deposito, tracciabilità e IA. Progetto accademico.",
    footerNav: "Navigazione",
    footerExplore: "Esplora",
    footerAccount: "Account",
    footerContact: "Contatto",
    footerFlow: "Percorso",
    footerFeatures: "Funzionalità",
    footerBackToTop: "Torna su",
    footerSocialNote: "Novità prodotto, demo e dietro le quinte del progetto Stokify.",
    footerCopyright: "© {year} Stokify — progetto accademico.",
  },

  ar: {
    email: "contact@stokify.app",
    hours: "ساعات العمل: 8:00 – 19:45",
    hoursShort: "8:00 – 19:45",
    tagline: "مخزون · تتبع · ذكاء اصطناعي",
    home: "الرئيسية",
    about: "حول",
    services: "الخدمات",
    projects: "نظرة عامة",
    navDiscover: "استكشف",
    navStats: "حقائق تقنية",
    navWhy: "عمليات متطلبة",
    navJourney: "مسار المخزون",
    login: "تسجيل الدخول",
    signup: "إنشاء حساب",
    lang: "اللغة",
    follow: "تابعنا",
    menuOpen: "فتح القائمة",
    menuClose: "إغلاق القائمة",
    navCatalog: "الكتالوج",
    navWishlist: "المفضلة",
    navOrders: "الطلبات",
    navProfile: "الملف",
    navCart: "السلة",
    navLogout: "تسجيل الخروج",
    navClientSpace: "مساحة العميل",
    loading: "جاري التحميل…",
    heroSlides: [
      {
        id: "warehouse-v2",
        eyebrow: "تحكم ذكي بالمستودع",
        title: "أدِر مستودعك مع Stokify",
        text: "متعدد الشركات والمستودعات، تتبع FEFO/FIFO وأمان حسب الأدوار — منصة مصممة للعمليات الحقيقية.",
      },
      {
        id: "dock-truck",
        eyebrow: "الرصيف والتسليمات",
        title: "من الرصيف إلى المخزون، كل شيء متزامن",
        text: "الاستلامات والحركات والمخارج في نظام واحد — تدفق لوجستي واضح وقابل للتتبع.",
      },
      {
        id: "smart-ops",
        eyebrow: "عمليات ذكية",
        title: "ذكاء اصطناعي وقرارات ميدانية",
        text: "توقعات واكتشاف شذوذ وتحسين لمساعدة أمناء المخازن والمسؤولين يومياً.",
      },
    ],
    heroLearnMore: "اعرف المزيد",
    heroSignupAria: "إنشاء حساب",
    heroSlidePrev: "الشريحة السابقة",
    heroSlideNext: "الشريحة التالية",
    heroTrialTitle: "جرّب Stokify مجاناً",
    heroNamePlaceholder: "اسمك",
    heroEmailPlaceholder: "البريد*",
    heroTruckAlt: "شاحنة توصيل",
    features: [
      {
        title: "متعدد الشركات والمستودعات",
        text: "اعزل البيانات حسب الشركة وأدِر عدة مستودعات من منصة واحدة.",
      },
      {
        title: "تتبع FEFO/FIFO",
        text: "تتبّع الدفعات والحركات وفق FEFO أو FIFO لمخارج مخزون متسقة.",
      },
      {
        title: "أمان حسب الأدوار",
        text: "مدير، مسؤول، أمين مخزن، محاسب وعميل: وصول محدود لكل ملف.",
      },
    ],
    featuresMagasinierAlt: "أمين مخزن Stokify مع عربة",
    featuresStatus: "تشغيلي",
    featuresStatusHover: "الشاحنة في الطريق",
    modulesEyebrow: "وحدات النظام",
    modulesTitle: "أربعة ركائز تشغيلية",
    modulesDesc:
      "يجمع Stokify الوحدات المهنية المنفّذة فعلياً في المشروع — من الشراء إلى الذكاء الاصطناعي.",
    modulesImageAlt: "رفوف المستودع — وحدات Stokify",
    modules: [
      {
        title: "المشتريات والاستلام",
        text: "طلبات الموردين والاستلام وتحديث المخزون فور الدخول للمستودع.",
      },
      {
        title: "المبيعات والفوترة",
        text: "مسار تجاري حتى الفوترة مع أثر متسق على المخزون.",
      },
      {
        title: "الجرد والانحرافات",
        text: "حملات جرد وإدخال ميداني وعرض الانحرافات لتصحيح المخزون.",
      },
      {
        title: "وحدة الذكاء الاصطناعي",
        text: "توقعات واكتشاف شذوذ واقتراحات تحسين لدعم القرارات التشغيلية.",
      },
    ],
    statsEyebrow: "بنية حقيقية",
    statsTitle: "حقائق تقنية لا أرقام تسويقية",
    statsDesc:
      "Stokify متعدد الشركات والمستودعات: كل شركة تعزل بياناتها ويمكن تشغيل عدة مستودعات في نفس السياق.",
    stats: [
      {
        value: "33",
        label: "وحدات الخلفية",
        detail: "مجالات وخدمات أعمال معروضة في واجهة Stokify",
      },
      {
        value: "4",
        label: "طرق التقييم",
        detail: "متوسط مرجح، FIFO، LIFO وآخر سعر شراء",
      },
      {
        value: "6",
        label: "أدوار المستخدمين",
        detail: "مشرف عام، مدير، مسؤول، أمين مخزن، محاسب، عميل",
      },
    ],
    marquee: [
      "مخزون",
      "تتبع",
      "ذكاء اصطناعي",
      "أمان",
      "متعدد الشركات",
      "متعدد المستودعات",
      "FEFO",
      "FIFO",
    ],
    whyEyebrow: "لماذا Stokify",
    whyTitle: "مصمم لعمليات مخزون متطلبة",
    whyDesc:
      "الميزات والأمان والبنية — التفاصيل التقنية الحقيقية للمشروع دون وعود تسويقية مختلقة.",
    whyImageAlt: "محطة قيادة — لوحة مخزون Stokify",
    whyTabs: [
      {
        id: "fonctionnalites",
        label: "الميزات",
        title: "مسار أعمال متكامل",
        points: [
          "مشتريات واستلام ومبيعات وجرد مرتبطة بالمخزون في الزمن الحقيقي.",
          "إدارة الدفعات والأرقام التسلسلية واستراتيجيات FEFO/FIFO.",
          "وحدة ذكاء اصطناعي للتوقع والشذوذ والتحسين التشغيلي.",
        ],
      },
      {
        id: "securite",
        label: "الأمان",
        title: "وصول مضبوط حسب الأدوار",
        points: [
          "ستة أدوار: مشرف عام، مدير، مسؤول، أمين مخزن، محاسب، عميل.",
          "صلاحيات معلنة في الواجهة وواجهة البرمجة (RBAC) لكل إجراء حساس.",
          "سياق متعدد الشركات: البيانات معزولة لكل شركة عبر JWT.",
        ],
      },
      {
        id: "architecture",
        label: "البنية التقنية",
        title: "منصة واضحة ومرنة",
        points: [
          "واجهة React 18 / Vite / Tailwind وخلفية Node منظمة حسب وحدات الأعمال.",
          "33 وحدة خلفية: مخزون وتجارة وتقييم وذكاء اصطناعي وإدارة.",
          "تقييم متعدد الطرق: متوسط، FIFO، LIFO وآخر سعر شراء.",
        ],
      },
    ],
    showcaseEyebrow: "معاينة المنتج",
    showcaseTitle: "واجهة Stokify أثناء العمل",
    showcaseDesc:
      "ثلاث شاشات ممثلة — لوحة التحكم والذكاء الاصطناعي والدفعات — بدل معارض مشاريع عامة.",
    showcases: [
      {
        title: "لوحة التحكم الرئيسية",
        text: "نظرة تشغيلية: مؤشرات المخزون ووصول سريع وإدارة متعددة المستودعات.",
        alt: "معاينة لوحة Stokify",
      },
      {
        title: "وحدة الذكاء الاصطناعي",
        text: "توقعات وشذوذ وتحسين في مركز مخصص.",
        alt: "معاينة وحدة الذكاء الاصطناعي",
      },
      {
        title: "إدارة الدفعات",
        text: "تتبع الدفعات والصلاحية والحالات لتتبع FEFO/FIFO يومي.",
        alt: "معاينة إدارة الدفعات",
      },
    ],
    ctaEyebrow: "جاهز للتجربة",
    ctaTitle: "استكشف Stokify على تدفقات مخزونك",
    ctaDesc:
      "منصة متعددة الشركات والمستودعات مع تتبع FEFO/FIFO وتقييم متعدد وأمان حسب الأدوار — مشروع تخرج وليس واجهة تسويقية وهمية.",
    ctaLogin: "تسجيل الدخول",

    introTitle: "إدارة المخزون، بمفهوم جديد.",
    introSubtitle:
      "Stokify يوحّد المخزون والمشتريات واللوجستiques في منصة ذكية واحدة.",
    introDiscover: "اكتشف Stokify",
    introExplore: "استكشف الميزات",
    introPlayVideo: "تشغيل الفيديو",
    introScrollHint: "اكتشف الصفحة الرئيسية",
    introChipAi: "ذكاء اصطناعي",
    introChipMulti: "مستودعات متعددة",
    introChipRealtime: "في الوقت الفعلي",

    flowEyebrow: "مسار المخزون",
    flowTitle: "من الرصيف إلى القيادة، تدفق واحد",
    flowDesc:
      "يربط Stokify الاستلام والتخزين والمخارج FEFO/FIFO والمؤشرات — نفس المسار التشغيلي الذي تعيشه فرقك على الأرض.",
    flowTruckAlt: "عامل مستودع Stokify مع لوحة وحدة الذكاء الاصطناعي",
    flowSteps: [
      {
        title: "الاستلام",
        text: "طلبات الموردين وتحديث المخزون فور دخول البضاعة للمستودع.",
      },
      {
        title: "التخزين",
        text: "دفعات ومواقع ومستودعات متعددة لرؤية واضحة لكل مقال.",
      },
      {
        title: "مخارج FEFO/FIFO",
        text: "حركات ومبيعات متوافقة مع استراتيجية الخروج المختارة.",
      },
      {
        title: "القيادة والذكاء الاصطناعي",
        text: "مؤشرات وجرد واقتراحات لاتخاذ القرار بسرعة أكبر.",
      },
    ],

    footerTagline:
      "Stokify — منصة مخزون متعددة الشركات والمستودعات مع التتبع والذكاء الاصطناعي. مشروع أكاديمي.",
    footerNav: "التنقل",
    footerExplore: "استكشف",
    footerAccount: "الحساب",
    footerContact: "تواصل",
    footerFlow: "المسار",
    footerFeatures: "الميزات",
    footerBackToTop: "إلى الأعلى",
    footerSocialNote: "تحديثات المنتج والعروض وكواليس مشروع Stokify.",
    footerCopyright: "© {year} Stokify — مشروع أكاديمي.",
  },
};

for (const [code, extras] of Object.entries(CLIENT_UI)) {
  if (DICTS[code]) Object.assign(DICTS[code], extras);
}
for (const [code, extras] of Object.entries(APP_UI)) {
  if (DICTS[code]) Object.assign(DICTS[code], extras);
}

/** @deprecated use LANG via context — kept for any leftover imports */
export const STRINGS = Object.fromEntries(
  Object.entries(DICTS).map(([code, dict]) => [
    code,
    {
      email: dict.email,
      hours: dict.hours,
      tagline: dict.tagline,
      home: dict.home,
      about: dict.about,
      services: dict.services,
      projects: dict.projects,
      login: dict.login,
      signup: dict.signup,
      lang: dict.lang,
      follow: dict.follow,
    },
  ])
);
