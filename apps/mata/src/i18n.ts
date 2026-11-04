import {
  applyDocumentLang,
  bootLocale as bootStored,
  persistLocale as persistStored,
  readStoredLocale,
  resolveLocale as resolveCatalog,
  useCatalog,
  type Store,
} from '@shell/chrome';

export const LOCALES = ['en', 'pt-BR', 'es', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export const LOCALE_KEY = 'mata.locale';

const en = {
  guideTitle: 'Give the grove a chance',
  guideIntro:
    'The season is paused. Plan your planting before time starts. You can pause again at any time.',
  guideStep1: 'Start with grass on sunny ground. Inspect water and soil before spending seeds.',
  guideStep2:
    'Ingá feeds its neighbors. Established crowns provide shade for ferns. Keep cacti in the sun.',
  guideStep3:
    'Water the most vulnerable plants and keep a reserve for the drought. Planting and watering also work while paused.',
  guideGoal:
    'At the end of the drought, keep at least {plants} plants, {kinds} species and {balance} balance.',
  guideTiming:
    'Drought begins on day {start}; the result arrives on day {end}. A full season lasts about six minutes at 1×.',
  guideAction: 'Plan my grove',
  help: 'Field guide',
  day: 'Day {n}',
  objective: 'Restoration goal',
  retry: 'Try this seed again',
  progress: '{plants} plants · {kinds} species · {balance} balance',

  resume: 'Resume session',
  loadSaved: 'Load checkpoint',
  exportSave: 'Export save',
  storageUnavailable:
    'Progress could not be saved in this browser. Keep this tab open and export a file before leaving. Saving must succeed before switching worlds.',
  operationFailed: 'The action could not be completed. Your current session is still available.',
  invalidSave:
    'This file is not a valid save for this game. Your current session has not been replaced.',
  bootFailed:
    'The game could not start or stopped responding. Reload to recover your last checkpoint.',
  reload: 'Reload game',
  retrySave: 'Retry saving',
  saving: 'Protecting your progress…',

  pageTitle: 'Mata',
  title: 'Mata',
  subtitle: 'Restore a scar. The grove decides if it lives.',
  plot42: 'Plot 42',
  name: 'Name',
  seed: 'Seed',
  newGame: 'New mata',
  continue: 'Continue',
  loadFile: 'Open file…',
  savedGroves: 'Saved groves',
  noSaves: 'No saved groves yet.',
  language: 'Language',
  balance: 'Balance',
  soil: 'Soil',
  moisture: 'Water',
  nutrients: 'Food',
  fauna: 'Fauna',
  unique: 'Kinds',
  planted: 'Cover',
  restored: 'Restored',
  drought: 'Drought',
  cistern: 'Cistern',
  seeds: 'Seeds',
  health: 'Health',
  droughtWarn: 'Drought in {n} days.',
  droughtNow: 'Drought. {n} days left.',
  won: 'The grove held.',
  wonHint: 'A mixed stand survived the dry spell.',
  lost: 'The scar won.',
  lostHint: 'Too few kinds, or the plants could not drink.',
  hint: 'Seeds and cistern are limited. Mix species, save water for the drought.',
  paused: 'Paused',
  pausedHint: 'Press a speed to resume.',
  saved: 'Mata saved.',
  loaded: 'Mata loaded.',
  save: 'Save',
  menu: 'Menu',
  credits: 'A Plot 42 grove. Original code and art.',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  tools: {
    grass: 'Grass',
    crown: 'Crown',
    fern: 'Fern',
    inga: 'Ingá',
    cactus: 'Cactus',
    water: 'Water',
    clear: 'Clear',
  },
  toolHint: {
    grass: 'Sun pioneer. Builds soil. Dies in deep shade.',
    crown: 'Casts shade. Drinks deep. Needs food.',
    fern: 'Needs shade. Holds moisture.',
    inga: 'Feeds neighboring soil.',
    cactus: 'Holds the dry. Needs full sun.',
    water: 'Spends cistern water. The grove still decides.',
    clear: 'Pull a plant.',
  },
  overlays: {
    none: 'View',
    moisture: 'Water',
    nutrients: 'Food',
    shade: 'Shade',
    soil: 'Soil',
    fauna: 'Fauna',
  },
  problems: {
    dry: 'Too dry',
    starved: 'Hungry for nutrients',
    'too-shady': 'Needs sun',
    'too-sunny': 'Needs shade',
    ailing: 'Weakening',
    bare: 'Bare ground',
    young: 'Still establishing',
  },
  inspector: 'Tile',
  kind: 'Species',
  age: 'Age',
  shade: 'Shade',
  boot: {
    graphics: 'Preparing the graphics…',
    grove: 'Reading the scar…',
    done: 'Ready',
  },
};

const ptBR: typeof en = {
  guideTitle: 'Dê uma chance à mata',
  guideIntro:
    'A estação está pausada. Planeje o plantio antes de iniciar o tempo. Você pode pausar novamente quando quiser.',
  guideStep1:
    'Comece com capim em áreas de sol. Inspecione a água e o solo antes de gastar sementes.',
  guideStep2:
    'O ingá alimenta os vizinhos. Copas desenvolvidas dão sombra às samambaias. Deixe os cactos no sol.',
  guideStep3:
    'Regue as plantas mais vulneráveis e reserve água para a seca. Você também pode plantar e regar com o tempo pausado.',
  guideGoal:
    'Ao fim da seca, mantenha pelo menos {plants} plantas, {kinds} espécies e {balance} de equilíbrio.',
  guideTiming:
    'A seca começa no dia {start}; o resultado chega no dia {end}. A estação completa dura cerca de seis minutos em 1×.',
  guideAction: 'Planejar minha mata',
  help: 'Guia de campo',
  day: 'Dia {n}',
  objective: 'Meta de restauração',
  retry: 'Tentar novamente nesta semente',
  progress: '{plants} plantas · {kinds} espécies · {balance} de equilíbrio',

  resume: 'Retomar partida',
  loadSaved: 'Carregar checkpoint',
  exportSave: 'Exportar partida',
  storageUnavailable:
    'Não foi possível salvar neste navegador. Mantenha esta aba aberta e exporte um arquivo antes de sair. É necessário salvar para trocar de mundo.',
  operationFailed: 'Não foi possível concluir a ação. Sua partida atual continua disponível.',
  invalidSave:
    'Este arquivo não é um save válido deste jogo. Sua partida atual não foi substituída.',
  bootFailed:
    'O jogo não iniciou ou parou de responder. Recarregue para recuperar o último checkpoint.',
  reload: 'Recarregar jogo',
  retrySave: 'Tentar salvar novamente',
  saving: 'Protegendo seu progresso…',

  pageTitle: 'Mata',
  title: 'Mata',
  subtitle: 'Restaure uma cicatriz. O bosque decide se vive.',
  plot42: 'Plot 42',
  name: 'Nome',
  seed: 'Semente',
  newGame: 'Nova mata',
  continue: 'Continuar',
  loadFile: 'Abrir arquivo…',
  savedGroves: 'Matas salvas',
  noSaves: 'Nenhuma mata salva ainda.',
  language: 'Idioma',
  balance: 'Equilíbrio',
  soil: 'Solo',
  moisture: 'Água',
  nutrients: 'Nutriente',
  fauna: 'Fauna',
  unique: 'Espécies',
  planted: 'Cobertura',
  restored: 'Restaurada',
  drought: 'Seca',
  cistern: 'Cisterna',
  seeds: 'Sementes',
  health: 'Saúde',
  droughtWarn: 'Seca em {n} dias.',
  droughtNow: 'Seca. Restam {n} dias.',
  won: 'A mata segurou.',
  wonHint: 'Um bosque misto atravessou o estio.',
  lost: 'A cicatriz venceu.',
  lostHint: 'Poucas espécies, ou as plantas não conseguiram beber.',
  hint: 'Sementes e cisterna são limitadas. Misture espécies e guarde água para a seca.',
  paused: 'Pausado',
  pausedHint: 'Escolha uma velocidade para continuar.',
  saved: 'Mata salva.',
  loaded: 'Mata carregada.',
  save: 'Salvar',
  menu: 'Menu',
  credits: 'Uma mata Plot 42. Código e arte originais.',
  soundOn: 'Som ligado',
  soundOff: 'Som desligado',
  tools: {
    grass: 'Capim',
    crown: 'Copa',
    fern: 'Samambaia',
    inga: 'Ingá',
    cactus: 'Cacto',
    water: 'Água',
    clear: 'Limpar',
  },
  toolHint: {
    grass: 'Pioneira de sol. Constrói solo. Morre na sombra densa.',
    crown: 'Faz sombra. Bebe fundo. Precisa de alimento.',
    fern: 'Precisa de sombra. Segura a umidade.',
    inga: 'Alimenta o solo vizinho.',
    cactus: 'Aguenta o seco. Precisa de sol pleno.',
    water: 'Gasta a cisterna. A mata ainda decide.',
    clear: 'Arranca uma planta.',
  },
  overlays: {
    none: 'Vista',
    moisture: 'Água',
    nutrients: 'Nutriente',
    shade: 'Sombra',
    soil: 'Solo',
    fauna: 'Fauna',
  },
  problems: {
    dry: 'Solo seco demais',
    starved: 'Falta de nutrientes',
    'too-shady': 'Precisa de sol',
    'too-sunny': 'Precisa de sombra',
    ailing: 'Enfraquecendo',
    bare: 'Terra nua',
    young: 'Ainda se estabelecendo',
  },
  inspector: 'Lote',
  kind: 'Espécie',
  age: 'Idade',
  shade: 'Sombra',
  boot: {
    graphics: 'Preparando os gráficos…',
    grove: 'Lendo a cicatriz…',
    done: 'Pronto',
  },
};

const es: typeof en = {
  guideTitle: 'Dale una oportunidad al bosque',
  guideIntro:
    'La estación está en pausa. Planifica antes de iniciar el tiempo. Puedes volver a pausar cuando quieras.',
  guideStep1: 'Empieza con hierba al sol. Inspecciona el agua y el suelo antes de gastar semillas.',
  guideStep2:
    'El ingá alimenta a sus vecinos. Las copas maduras dan sombra a los helechos. Mantén los cactus al sol.',
  guideStep3:
    'Riega las plantas vulnerables y reserva agua para la sequía. También puedes plantar y regar en pausa.',
  guideGoal:
    'Al terminar la sequía, conserva al menos {plants} plantas, {kinds} especies y {balance} de equilibrio.',
  guideTiming:
    'La sequía empieza el día {start}; el resultado llega el día {end}. Una estación dura unos seis minutos a 1×.',
  guideAction: 'Planificar mi bosque',
  help: 'Guía de campo',
  day: 'Día {n}',
  objective: 'Meta de restauración',
  retry: 'Reintentar esta semilla',
  progress: '{plants} plantas · {kinds} especies · {balance} de equilibrio',

  resume: 'Reanudar partida',
  loadSaved: 'Cargar punto de guardado',
  exportSave: 'Exportar partida',
  storageUnavailable:
    'No se pudo guardar en este navegador. Mantén esta pestaña abierta y exporta un archivo antes de salir. Debes guardar antes de cambiar de mundo.',
  operationFailed: 'No se pudo completar la acción. Tu partida actual sigue disponible.',
  invalidSave:
    'Este archivo no es una partida válida para este juego. Tu partida actual no se ha reemplazado.',
  bootFailed:
    'El juego no pudo iniciarse o dejó de responder. Recarga para recuperar el último guardado.',
  reload: 'Recargar juego',
  retrySave: 'Reintentar guardado',
  saving: 'Protegiendo tu progreso…',

  pageTitle: 'Mata',
  title: 'Mata',
  subtitle: 'Restaura una cicatriz. El bosque decide si vive.',
  plot42: 'Plot 42',
  name: 'Nombre',
  seed: 'Semilla',
  newGame: 'Nueva mata',
  continue: 'Continuar',
  loadFile: 'Abrir archivo…',
  savedGroves: 'Bosques guardados',
  noSaves: 'Aún no hay bosques guardados.',
  language: 'Idioma',
  balance: 'Equilibrio',
  soil: 'Suelo',
  moisture: 'Agua',
  nutrients: 'Nutriente',
  fauna: 'Fauna',
  unique: 'Tipos',
  planted: 'Cubierta',
  restored: 'Restaurada',
  drought: 'Sequía',
  cistern: 'Cisterna',
  seeds: 'Semillas',
  health: 'Salud',
  droughtWarn: 'Sequía en {n} días.',
  droughtNow: 'Sequía. Quedan {n} días.',
  won: 'El bosque resistió.',
  wonHint: 'Un rodal mixto sobrevivió el estiaje.',
  lost: 'La cicatriz ganó.',
  lostHint: 'Pocas especies, o las plantas no pudieron beber.',
  hint: 'Semillas y cisterna son limitadas. Mezcla especies y guarda agua para la sequía.',
  paused: 'En pausa',
  pausedHint: 'Elige una velocidad para seguir.',
  saved: 'Mata guardada.',
  loaded: 'Mata cargada.',
  save: 'Guardar',
  menu: 'Menú',
  credits: 'Un bosque de Plot 42. Código y arte originales.',
  soundOn: 'Sonido activado',
  soundOff: 'Sonido desactivado',
  tools: {
    grass: 'Hierba',
    crown: 'Copa',
    fern: 'Helecho',
    inga: 'Ingá',
    cactus: 'Cacto',
    water: 'Agua',
    clear: 'Quitar',
  },
  toolHint: {
    grass: 'Pionera de sol. Construye suelo. Muere a la sombra densa.',
    crown: 'Da sombra. Bebe hondo. Necesita alimento.',
    fern: 'Necesita sombra. Retiene humedad.',
    inga: 'Alimenta el suelo vecino.',
    cactus: 'Aguanta lo seco. Necesita sol pleno.',
    water: 'Gasta la cisterna. El bosque aún decide.',
    clear: 'Arranca una planta.',
  },
  overlays: {
    none: 'Vista',
    moisture: 'Agua',
    nutrients: 'Nutriente',
    shade: 'Sombra',
    soil: 'Suelo',
    fauna: 'Fauna',
  },
  problems: {
    dry: 'Demasiado seco',
    starved: 'Falta de nutrientes',
    'too-shady': 'Necesita sol',
    'too-sunny': 'Necesita sombra',
    ailing: 'Debilitándose',
    bare: 'Suelo desnudo',
    young: 'Aún se establece',
  },
  inspector: 'Casilla',
  kind: 'Especie',
  age: 'Edad',
  shade: 'Sombra',
  boot: {
    graphics: 'Preparando los gráficos…',
    grove: 'Leyendo la cicatriz…',
    done: 'Listo',
  },
};

const fr: typeof en = {
  guideTitle: 'Donnez une chance au bosquet',
  guideIntro:
    'La saison est en pause. Préparez vos plantations avant de lancer le temps. Vous pouvez toujours remettre en pause.',
  guideStep1:
    'Commencez par des herbes au soleil. Inspectez l’eau et le sol avant de dépenser des graines.',
  guideStep2:
    'L’ingá nourrit ses voisins. Les couronnes adultes ombragent les fougères. Gardez les cactus au soleil.',
  guideStep3:
    'Arrosez les plantes fragiles et gardez de l’eau pour la sécheresse. Planter et arroser restent possibles en pause.',
  guideGoal:
    'À la fin de la sécheresse, gardez au moins {plants} plantes, {kinds} espèces et {balance} d’équilibre.',
  guideTiming:
    'La sécheresse commence au jour {start}; le résultat arrive au jour {end}. Une saison dure environ six minutes à 1×.',
  guideAction: 'Préparer mon bosquet',
  help: 'Guide de terrain',
  day: 'Jour {n}',
  objective: 'Objectif de restauration',
  retry: 'Réessayer cette graine',
  progress: '{plants} plantes · {kinds} espèces · {balance} d’équilibre',

  resume: 'Reprendre la partie',
  loadSaved: 'Charger la sauvegarde',
  exportSave: 'Exporter la partie',
  storageUnavailable:
    'Impossible de sauvegarder dans ce navigateur. Gardez cet onglet ouvert et exportez un fichier avant de quitter. La sauvegarde doit réussir avant de changer de monde.',
  operationFailed: 'Cette action a échoué. Votre partie actuelle reste disponible.',
  invalidSave:
    'Ce fichier ne contient pas une sauvegarde valide pour ce jeu. Votre partie actuelle est conservée.',
  bootFailed:
    'Le jeu ne démarre pas ou ne répond plus. Rechargez pour récupérer la dernière sauvegarde.',
  reload: 'Recharger le jeu',
  retrySave: 'Réessayer la sauvegarde',
  saving: 'Protection de votre progression…',

  pageTitle: 'Mata',
  title: 'Mata',
  subtitle: 'Réparez une cicatrice. Le bosquet décide s’il vit.',
  plot42: 'Plot 42',
  name: 'Nom',
  seed: 'Graine',
  newGame: 'Nouvelle mata',
  continue: 'Continuer',
  loadFile: 'Ouvrir un fichier…',
  savedGroves: 'Bosquets enregistrés',
  noSaves: 'Aucun bosquet enregistré pour l’instant.',
  language: 'Langue',
  balance: 'Équilibre',
  soil: 'Sol',
  moisture: 'Eau',
  nutrients: 'Nourriture',
  fauna: 'Faune',
  unique: 'Espèces',
  planted: 'Couvert',
  restored: 'Restaurée',
  drought: 'Sécheresse',
  cistern: 'Citerne',
  seeds: 'Graines',
  health: 'Santé',
  droughtWarn: 'Sécheresse dans {n} jours.',
  droughtNow: 'Sécheresse. {n} jours restants.',
  won: 'Le bosquet a tenu.',
  wonHint: 'Un peuplement mixte a traversé le sec.',
  lost: 'La cicatrice a gagné.',
  lostHint: 'Trop peu d’espèces, ou les plantes n’ont pas pu boire.',
  hint: 'Graines et citerne sont limitées. Mélangez et gardez de l’eau pour la sécheresse.',
  paused: 'En pause',
  pausedHint: 'Choisissez une vitesse pour reprendre.',
  saved: 'Mata enregistrée.',
  loaded: 'Mata chargée.',
  save: 'Enregistrer',
  menu: 'Menu',
  credits: 'Un bosquet Plot 42. Code et art originaux.',
  soundOn: 'Son activé',
  soundOff: 'Son coupé',
  tools: {
    grass: 'Herbe',
    crown: 'Cime',
    fern: 'Fougère',
    inga: 'Ingá',
    cactus: 'Cactus',
    water: 'Eau',
    clear: 'Retirer',
  },
  toolHint: {
    grass: 'Pionnière de soleil. Construit le sol. Meurt à l’ombre dense.',
    crown: 'Fait de l’ombre. Boit beaucoup. A besoin de nourriture.',
    fern: 'A besoin d’ombre. Retient l’humidité.',
    inga: 'Nourrit le sol voisin.',
    cactus: 'Tient le sec. A besoin de plein soleil.',
    water: 'Dépense la citerne. Le bosquet décide encore.',
    clear: 'Arrache une plante.',
  },
  overlays: {
    none: 'Vue',
    moisture: 'Eau',
    nutrients: 'Nourriture',
    shade: 'Ombre',
    soil: 'Sol',
    fauna: 'Faune',
  },
  problems: {
    dry: 'Trop sec',
    starved: 'Manque de nutriments',
    'too-shady': 'A besoin de soleil',
    'too-sunny': 'A besoin d’ombre',
    ailing: 'S’affaiblit',
    bare: 'Sol nu',
    young: 'Encore jeune',
  },
  inspector: 'Case',
  kind: 'Espèce',
  age: 'Âge',
  shade: 'Ombre',
  boot: {
    graphics: 'Préparation des graphismes…',
    grove: 'Lecture de la cicatrice…',
    done: 'Prêt',
  },
};

const de: typeof en = {
  guideTitle: 'Gib dem Hain eine Chance',
  guideIntro:
    'Die Saison ist pausiert. Plane die Bepflanzung, bevor du die Zeit startest. Du kannst jederzeit wieder pausieren.',
  guideStep1:
    'Beginne mit Gras auf sonnigem Boden. Prüfe Wasser und Boden, bevor du Samen verbrauchst.',
  guideStep2:
    'Ingá versorgt Nachbarn mit Nährstoffen. Ausgewachsene Kronen beschatten Farne. Kakteen brauchen Sonne.',
  guideStep3:
    'Bewässere gefährdete Pflanzen und spare Wasser für die Dürre. Pflanzen und Gießen funktionieren auch in der Pause.',
  guideGoal:
    'Erhalte bis zum Ende der Dürre mindestens {plants} Pflanzen, {kinds} Arten und {balance} Gleichgewicht.',
  guideTiming:
    'Die Dürre beginnt an Tag {start}; das Ergebnis kommt an Tag {end}. Eine Saison dauert bei 1× etwa sechs Minuten.',
  guideAction: 'Meinen Hain planen',
  help: 'Feldhandbuch',
  day: 'Tag {n}',
  objective: 'Renaturierungsziel',
  retry: 'Diesen Startwert erneut versuchen',
  progress: '{plants} Pflanzen · {kinds} Arten · {balance} Gleichgewicht',

  resume: 'Partie fortsetzen',
  loadSaved: 'Spielstand laden',
  exportSave: 'Spielstand exportieren',
  storageUnavailable:
    'Speichern in diesem Browser fehlgeschlagen. Lass diesen Tab geöffnet und exportiere eine Datei, bevor du ihn verlässt. Speichere erfolgreich, bevor du die Welt wechselst.',
  operationFailed: 'Die Aktion ist fehlgeschlagen. Deine aktuelle Partie ist weiterhin verfügbar.',
  invalidSave:
    'Diese Datei ist kein gültiger Spielstand für dieses Spiel. Deine aktuelle Partie wurde nicht ersetzt.',
  bootFailed:
    'Das Spiel konnte nicht starten oder reagiert nicht mehr. Lade neu, um den letzten Spielstand wiederherzustellen.',
  reload: 'Spiel neu laden',
  retrySave: 'Erneut speichern',
  saving: 'Dein Fortschritt wird gesichert…',

  pageTitle: 'Mata',
  title: 'Mata',
  subtitle: 'Heile eine Narbe. Der Hain entscheidet, ob er lebt.',
  plot42: 'Plot 42',
  name: 'Name',
  seed: 'Samen',
  newGame: 'Neue Mata',
  continue: 'Fortsetzen',
  loadFile: 'Datei öffnen…',
  savedGroves: 'Gespeicherte Haine',
  noSaves: 'Noch keine gespeicherten Haine.',
  language: 'Sprache',
  balance: 'Gleichgewicht',
  soil: 'Boden',
  moisture: 'Wasser',
  nutrients: 'Nährstoff',
  fauna: 'Fauna',
  unique: 'Arten',
  planted: 'Deckung',
  restored: 'Wiederhergestellt',
  drought: 'Dürre',
  cistern: 'Zisterne',
  seeds: 'Samen',
  health: 'Gesundheit',
  droughtWarn: 'Dürre in {n} Tagen.',
  droughtNow: 'Dürre. Noch {n} Tage.',
  won: 'Der Hain hielt stand.',
  wonHint: 'Ein gemischter Bestand überstand die Trockenheit.',
  lost: 'Die Narbe siegte.',
  lostHint: 'Zu wenige Arten, oder die Pflanzen konnten nicht trinken.',
  hint: 'Samen und Zisterne sind begrenzt. Mische Arten und spare Wasser für die Dürre.',
  paused: 'Pausiert',
  pausedHint: 'Wähle eine Geschwindigkeit, um weiterzumachen.',
  saved: 'Mata gespeichert.',
  loaded: 'Mata geladen.',
  save: 'Speichern',
  menu: 'Menü',
  credits: 'Ein Plot-42-Hain. Eigener Code und eigene Kunst.',
  soundOn: 'Ton an',
  soundOff: 'Ton aus',
  tools: {
    grass: 'Gras',
    crown: 'Krone',
    fern: 'Farn',
    inga: 'Ingá',
    cactus: 'Kaktus',
    water: 'Wasser',
    clear: 'Entfernen',
  },
  toolHint: {
    grass: 'Sonnen-Pionier. Baut Boden. Stirbt im tiefen Schatten.',
    crown: 'Wirft Schatten. Trinkt tief. Braucht Nahrung.',
    fern: 'Braucht Schatten. Hält Feuchte.',
    inga: 'Nährt den Nachbarboden.',
    cactus: 'Hält die Trockenheit. Braucht volle Sonne.',
    water: 'Verbraucht Zisternenwasser. Der Hain entscheidet weiter.',
    clear: 'Zieht eine Pflanze.',
  },
  overlays: {
    none: 'Sicht',
    moisture: 'Wasser',
    nutrients: 'Nährstoff',
    shade: 'Schatten',
    soil: 'Boden',
    fauna: 'Fauna',
  },
  problems: {
    dry: 'Zu trocken',
    starved: 'Hungrig nach Nährstoffen',
    'too-shady': 'Braucht Sonne',
    'too-sunny': 'Braucht Schatten',
    ailing: 'Wird schwach',
    bare: 'Kahler Boden',
    young: 'Noch im Anwachsen',
  },
  inspector: 'Feld',
  kind: 'Art',
  age: 'Alter',
  shade: 'Schatten',
  boot: {
    graphics: 'Grafik wird vorbereitet…',
    grove: 'Narbe wird gelesen…',
    done: 'Fertig',
  },
};

const CATALOGS = { en, 'pt-BR': ptBR, es, fr, de } as const;
export type Strings = typeof en;

export function matchLocale(tag: string): Locale | null {
  const lower = tag.trim().toLowerCase().replaceAll('_', '-');
  if (lower === 'pt' || lower.startsWith('pt-')) return 'pt-BR';
  const base = lower.split('-')[0];
  if (base === 'en') return 'en';
  if (base === 'es') return 'es';
  if (base === 'fr') return 'fr';
  if (base === 'de') return 'de';
  return null;
}

export function resolveLocale(options?: {
  stored?: string | null;
  languages?: readonly string[];
}): Locale {
  return resolveCatalog({
    locales: LOCALES,
    fallback: 'en',
    match: matchLocale,
    stored: options?.stored !== undefined ? options.stored : readStoredLocale(LOCALE_KEY),
    languages: options?.languages,
  });
}

export function persistLocale(locale: Locale): void {
  persistStored(LOCALE_KEY, locale);
}

export function bootLocale(): Locale {
  return bootStored(LOCALE_KEY, (stored) => resolveLocale({ stored }));
}

export function catalog(locale: Locale): Strings {
  return CATALOGS[locale] ?? en;
}

export function useStrings(ui: Store<{ locale: Locale }>): Strings {
  return useCatalog(ui, catalog);
}

export function applyDocumentLocale(locale: Locale): void {
  applyDocumentLang(locale, catalog(locale).pageTitle);
}
