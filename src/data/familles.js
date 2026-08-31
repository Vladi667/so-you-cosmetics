// Les six familles commerciales.
//
// Pourquoi ces pages existent
// ---------------------------
// Les rubriques de la boutique répondent à « montre-moi les savons ». Elles ne
// répondent pas à « quel savon pour une peau qui tire », ni à « comment passer
// au shampoing solide », ni à « où acheter de l'argile à Genève ». Ce sont
// pourtant ces recherches-là qui portent une intention d'achat, et aucune page
// du site ne les vise aujourd'hui.
//
// Une rubrique est une liste. Une famille explique d'abord, puis propose. C'est
// la différence entre être trouvé par son nom — ce qui suppose qu'on nous
// connaisse déjà — et être trouvé par un besoin.
//
// Ce qui a été délibérément écarté
// --------------------------------
// L'atelier et le sur-mesure ont déjà leurs pages, qui visent « atelier savon
// Genève » et « cadeau d'entreprise personnalisé ». Les redoubler ferait deux
// pages en concurrence sur la même recherche, et Google n'en garderait qu'une —
// probablement pas celle qu'on aurait choisie.
//
// Sur les trois langues
// ---------------------
// Même partage que dans server/seo.js, et pour la même raison. L'anglais vise
// un marché réel : Genève compte des dizaines de milliers d'anglophones et
// « natural soap Geneva » ne remonte aucune boutique locale. L'allemand est une
// courtoisie envers les visiteurs suisses alémaniques : le terrain y est tenu
// depuis des années par des savonneries établies, et prétendre le disputer
// depuis Genève serait se mentir.

export const FAMILLES = [
  {
    slug: 'savon-saponifie-a-froid',
    rubrique: 'Savons',
    image: '/artisanal_soap_crafting.png',
    fr: {
      titre: 'Savon saponifié à froid',
      chapeau: 'Fabriqué à Genève, en petites séries, sans chauffer la pâte.',
      intro:
        'La saponification à froid est la méthode la plus lente et la plus coûteuse pour faire un savon. Elle est aussi la seule qui conserve intacte la glycérine née de la réaction — celle que l’industrie retire pour la revendre ailleurs, et qui laisse la peau souple au lieu de la laisser tirer.',
      sections: [
        {
          titre: 'Ce que « à froid » change réellement',
          corps:
            'Un savon industriel est cuit, puis relargué : la glycérine part avec l’eau de lavage. Un savon saponifié à froid n’est jamais porté au-delà de la température ambiante ; la glycérine reste dedans, à hauteur d’environ 8 % du poids fini. C’est ce qui explique qu’un savon artisanal fonde plus vite dans une douche mal drainée — il est vivant, il boit l’eau — et qu’il n’assèche pas.',
        },
        {
          titre: 'Le surgras, et pourquoi il se choisit',
          corps:
            'On introduit toujours un peu plus de corps gras que la soude ne peut en transformer. Cet excédent — le surgras — reste libre dans le savon et nourrit la peau pendant le lavage. Nos formules tournent entre 6 et 9 % selon l’usage : plus haut pour un savon de visage, plus bas pour un savon de ménage qui doit rester franc.',
        },
        {
          titre: 'Quatre semaines de cure, et rien pour les accélérer',
          corps:
            'Après le moulage, le savon repose un mois. La réaction s’achève, l’eau s’évapore, la barre durcit. Un savon vendu trop tôt est mou, se consume en quinze jours et peut rester légèrement caustique. C’est le délai qui rend la fabrication artisanale difficile à industrialiser, et c’est aussi celui qu’on ne peut pas raccourcir.',
        },
      ],
      question: 'Comment reconnaître un vrai savon saponifié à froid ?',
      reponse:
        'La liste INCI commence par des corps gras saponifiés — « Sodium Olivate », « Sodium Cocoate » — et non par « Sodium Palmate » suivi d’une longue série de tensioactifs. La mention « surgras » y figure, et la barre porte une date de fabrication : la cure se compte.',
    },
    en: {
      titre: 'Cold-process soap',
      chapeau: 'Made in Geneva, in small batches, without ever heating the paste.',
      intro:
        'Cold process is the slowest and most expensive way to make soap. It is also the only one that keeps the glycerin created by the reaction — the very thing industry strips out to sell elsewhere, and the reason a handmade bar leaves skin supple instead of tight.',
      sections: [
        {
          titre: 'What “cold” actually changes',
          corps:
            'Industrial soap is cooked, then salted out: the glycerin leaves with the wash water. A cold-process bar never goes above room temperature, so the glycerin stays in — roughly 8 % of the finished weight. That is why an artisan bar melts faster on a badly drained soap dish, and why it does not dry the skin.',
        },
        {
          titre: 'Superfat, and why it is a choice',
          corps:
            'We always add slightly more oil than the lye can convert. That excess — the superfat — stays free in the bar and feeds the skin while you wash. Our formulas sit between 6 and 9 %: higher for a face bar, lower for a household bar that needs to stay direct.',
        },
        {
          titre: 'Four weeks of cure, and no way to hurry it',
          corps:
            'After moulding, the soap rests for a month. The reaction finishes, water evaporates, the bar hardens. Sold too early it is soft, gone in a fortnight, and may still be faintly caustic. This delay is what makes artisan soap hard to industrialise — and it is the one step nobody can shorten.',
        },
      ],
      question: 'How do you recognise a genuine cold-process soap?',
      reponse:
        'The INCI list opens with saponified oils — “Sodium Olivate”, “Sodium Cocoate” — not with “Sodium Palmate” followed by a run of surfactants. Superfat is stated, and the bar carries a making date, because the cure is counted.',
    },
    de: {
      titre: 'Kaltgerührte Seife',
      chapeau: 'In Genf hergestellt, in kleinen Chargen, ohne die Masse zu erhitzen.',
      intro:
        'Die Kaltverseifung ist die langsamste und teuerste Art, Seife zu machen. Sie ist auch die einzige, bei der das entstehende Glycerin in der Seife bleibt — jenes Glycerin, das die Industrie herauslöst und anderweitig verkauft.',
      sections: [
        {
          titre: 'Was „kalt“ wirklich verändert',
          corps:
            'Industrieseife wird gekocht und ausgesalzen; das Glycerin geht mit dem Waschwasser verloren. Kaltgerührte Seife kommt nie über Raumtemperatur, das Glycerin bleibt drin — etwa 8 % des Fertiggewichts. Deshalb löst sich handgemachte Seife in einer schlecht abtropfenden Schale schneller auf, und deshalb trocknet sie die Haut nicht aus.',
        },
        {
          titre: 'Überfettung als bewusste Entscheidung',
          corps:
            'Wir geben stets etwas mehr Öl zu, als die Lauge umsetzen kann. Dieser Überschuss bleibt frei in der Seife und pflegt die Haut beim Waschen. Unsere Rezepturen liegen zwischen 6 und 9 %.',
        },
        {
          titre: 'Vier Wochen Reifezeit',
          corps:
            'Nach dem Gießen ruht die Seife einen Monat. Die Reaktion klingt aus, Wasser verdunstet, das Stück wird hart. Zu früh verkauft ist sie weich und nach zwei Wochen aufgebraucht.',
        },
      ],
      question: 'Woran erkennt man echte kaltgerührte Seife?',
      reponse:
        'Die INCI-Liste beginnt mit verseiften Ölen — „Sodium Olivate“, „Sodium Cocoate“ — und nicht mit „Sodium Palmate“ und einer Reihe von Tensiden. Die Überfettung ist angegeben.',
    },
  },

  {
    slug: 'shampoing-solide',
    rubrique: 'Soins Capillaires',
    image: '/botanical_flatlay.png',
    fr: {
      titre: 'Shampoing solide',
      chapeau: 'Passer au solide sans se rater, et savoir à quoi s’attendre.',
      intro:
        'Un shampoing solide n’est pas un savon à cheveux. Les deux existent, ils ne se comportent pas pareil, et confondre les deux est la raison la plus fréquente d’un passage au solide qui tourne mal.',
      sections: [
        {
          titre: 'Savon à cheveux ou shampoing solide : ce n’est pas la même chose',
          corps:
            'Un savon à cheveux est saponifié : son pH tourne autour de 9, il ouvre l’écaille du cheveu et demande un rinçage acide — une cuillère de vinaigre dans un litre d’eau — pour la refermer. Un shampoing solide est un tensioactif compacté, au pH proche de celui du cuir chevelu, et se comporte comme un shampoing liquide dont on aurait retiré l’eau. Sur cheveux colorés ou très secs, le second est plus sûr.',
        },
        {
          titre: 'Les trois semaines dont personne ne prévient',
          corps:
            'Un cuir chevelu habitué aux silicones produit du sébum pour compenser ce qu’on lui retire. En passant au solide, cette production ne s’arrête pas du jour au lendemain : comptez deux à trois semaines de cheveux plus lourds avant que l’équilibre revienne. Beaucoup abandonnent à la deuxième semaine en concluant que le produit ne convient pas.',
        },
        {
          titre: 'Le faire durer',
          corps:
            'Un pain de 60 g remplace environ deux flacons de 250 ml, à condition qu’il sèche entre deux usages. Posé au fond d’une douche, il fond ; sur un porte-savon drainant, hors du jet, il tient trois à quatre mois. C’est le seul geste qui change vraiment sa durée de vie.',
        },
      ],
      question: 'Mon shampoing solide ne mousse presque pas, est-ce normal ?',
      reponse:
        'Oui, sur les premiers lavages. La mousse dépend de ce qui reste sur le cheveu : sur une chevelure encore chargée en silicones, elle vient mal. Elle revient d’elle-même une fois le cheveu dégagé. Mouiller abondamment et frotter le pain entre les mains plutôt que directement sur la tête aide aussi.',
    },
    en: {
      titre: 'Solid shampoo',
      chapeau: 'Switching to solid without getting it wrong.',
      intro:
        'A solid shampoo is not a hair soap. Both exist, they behave differently, and confusing the two is the most common reason a switch to solid goes badly.',
      sections: [
        {
          titre: 'Hair soap and solid shampoo are not the same thing',
          corps:
            'Hair soap is saponified: its pH sits around 9, it lifts the hair cuticle and needs an acid rinse — a spoon of vinegar in a litre of water — to close it again. A solid shampoo is a compacted surfactant at a pH close to the scalp’s, behaving like a liquid shampoo with the water taken out. On coloured or very dry hair, the second is the safer choice.',
        },
        {
          titre: 'The three weeks nobody warns you about',
          corps:
            'A scalp used to silicones produces oil to compensate for what is being stripped. That production does not stop overnight: expect two to three weeks of heavier hair before the balance returns. Most people give up in week two and conclude the product does not suit them.',
        },
        {
          titre: 'Making it last',
          corps:
            'A 60 g bar replaces roughly two 250 ml bottles — provided it dries between uses. Left in the bottom of a shower it dissolves; on a draining dish, out of the spray, it lasts three to four months.',
        },
      ],
      question: 'My solid shampoo barely lathers — is that normal?',
      reponse:
        'Yes, for the first few washes. Lather depends on what is still coating the hair: on a silicone-loaded head it comes poorly, and returns on its own once the hair is clear. Wetting generously and rubbing the bar between your hands rather than directly on your head also helps.',
    },
    de: {
      titre: 'Festes Shampoo',
      chapeau: 'Der Umstieg auf fest — und was dabei wirklich passiert.',
      intro:
        'Festes Shampoo ist keine Haarseife. Beides gibt es, beides verhält sich anders, und die Verwechslung ist der häufigste Grund für einen misslungenen Umstieg.',
      sections: [
        {
          titre: 'Haarseife und festes Shampoo sind nicht dasselbe',
          corps:
            'Haarseife ist verseift, ihr pH liegt bei etwa 9, sie öffnet die Schuppenschicht und verlangt eine saure Spülung. Festes Shampoo ist ein verdichtetes Tensid mit kopfhautnahem pH-Wert. Bei gefärbtem oder sehr trockenem Haar ist Letzteres die sicherere Wahl.',
        },
        {
          titre: 'Die drei Wochen, vor denen niemand warnt',
          corps:
            'Eine an Silikone gewöhnte Kopfhaut produziert Talg zum Ausgleich. Diese Produktion hört nicht über Nacht auf: Rechnen Sie mit zwei bis drei Wochen schwererem Haar, bevor sich das Gleichgewicht einstellt.',
        },
        {
          titre: 'Haltbarkeit',
          corps:
            'Ein 60-g-Stück ersetzt etwa zwei 250-ml-Flaschen — sofern es zwischen den Anwendungen trocknet. Auf einer ablaufenden Schale hält es drei bis vier Monate.',
        },
      ],
      question: 'Mein festes Shampoo schäumt kaum — ist das normal?',
      reponse:
        'Ja, bei den ersten Wäschen. Der Schaum hängt davon ab, was noch im Haar sitzt. Er kommt von selbst zurück, sobald das Haar frei ist.',
    },
  },

  {
    slug: 'cosmetique-zero-dechet',
    rubrique: 'Bain & Bien-être',
    image: '/premium_product_stone.png',
    fr: {
      titre: 'Cosmétique zéro déchet à Genève',
      chapeau: 'Le solide, le vrac, et le flacon qu’on rapporte.',
      intro:
        'Une salle de bain produit peu de déchets en poids et beaucoup en nombre : des flacons de 250 ml qu’on remplace chaque mois. Le solide et la recharge s’attaquent à ce nombre-là, sans demander de changer ses habitudes d’un coup.',
      sections: [
        {
          titre: 'Rapporter son flacon',
          corps:
            'Nos soins liquides se rechargent en boutique. Vous rapportez le flacon vide, nous le remplissons, vous payez le produit et non le contenant. C’est moins cher qu’un neuf, et le contenant qui dure est toujours celui qu’on n’a pas fabriqué.',
        },
        {
          titre: 'Ce que le solide supprime vraiment',
          corps:
            'Un shampoing liquide, c’est environ 80 % d’eau transportée dans du plastique. Un pain de 60 g rend le même service que deux flacons de 250 ml : le plastique disparaît, et le transport avec — on ne déplace plus l’eau, que vous avez déjà chez vous.',
        },
        {
          titre: 'Commencer par un seul produit',
          corps:
            'Remplacer toute une salle de bain d’un coup est le meilleur moyen d’abandonner. Le savon de corps est la transition la plus simple : le geste ne change pas, le résultat est immédiat. Le shampoing vient ensuite, quand on est prêt à traverser les trois semaines d’adaptation.',
        },
      ],
      question: 'Où recharger ses cosmétiques à Genève ?',
      reponse:
        'À la boutique, 3 avenue Pictet-De-Rochemont, aux Eaux-Vives. Apportez le flacon propre et sec ; le remplissage se fait sur place, sans rendez-vous, pendant les heures d’ouverture.',
    },
    en: {
      titre: 'Zero-waste cosmetics in Geneva',
      chapeau: 'Solid bars, refills, and the bottle you bring back.',
      intro:
        'A bathroom produces little waste by weight and a great deal by count: 250 ml bottles replaced every month. Solid bars and refills attack that count, without asking you to change everything at once.',
      sections: [
        {
          titre: 'Bring your bottle back',
          corps:
            'Our liquid products can be refilled in the boutique. You bring the empty bottle, we fill it, you pay for the product and not the container. It costs less than a new one — and the container that lasts is always the one nobody had to make.',
        },
        {
          titre: 'What solid actually removes',
          corps:
            'Liquid shampoo is roughly 80 % water carried in plastic. A 60 g bar does the work of two 250 ml bottles: the plastic goes, and so does the freight — we stop shipping water you already have at home.',
        },
        {
          titre: 'Start with one product',
          corps:
            'Replacing a whole bathroom at once is the surest way to give up. Body soap is the easiest switch: the gesture is unchanged and the result immediate. Shampoo comes next, when you are ready for the three-week adjustment.',
        },
      ],
      question: 'Where can I refill cosmetics in Geneva?',
      reponse:
        'At the boutique, 3 avenue Pictet-De-Rochemont, in Eaux-Vives. Bring the bottle clean and dry; refilling is done on the spot, no appointment, during opening hours.',
    },
    de: {
      titre: 'Zero-Waste-Kosmetik in Genf',
      chapeau: 'Feste Produkte, Nachfüllen, und die Flasche, die zurückkommt.',
      intro:
        'Ein Badezimmer erzeugt wenig Abfall nach Gewicht und viel nach Stückzahl. Feste Produkte und Nachfüllungen setzen genau dort an.',
      sections: [
        {
          titre: 'Die Flasche zurückbringen',
          corps:
            'Unsere flüssigen Produkte lassen sich in der Boutique nachfüllen. Sie bringen die leere Flasche, wir füllen sie, Sie bezahlen das Produkt und nicht das Gefäss.',
        },
        {
          titre: 'Was fest wirklich einspart',
          corps:
            'Flüssiges Shampoo besteht zu rund 80 % aus Wasser, transportiert in Plastik. Ein 60-g-Stück leistet dasselbe wie zwei 250-ml-Flaschen.',
        },
        {
          titre: 'Mit einem Produkt beginnen',
          corps:
            'Alles auf einmal zu ersetzen führt meist zum Aufgeben. Körperseife ist der einfachste Anfang: die Geste bleibt, das Ergebnis kommt sofort.',
        },
      ],
      question: 'Wo kann man in Genf Kosmetik nachfüllen?',
      reponse:
        'In der Boutique, 3 avenue Pictet-De-Rochemont, Eaux-Vives. Bringen Sie die Flasche sauber und trocken mit; nachgefüllt wird vor Ort, ohne Termin.',
    },
  },

  {
    slug: 'soins-peaux-sensibles',
    rubrique: 'Soins Visage',
    image: '/workshop_ingredients.png',
    fr: {
      titre: 'Soins pour peaux sensibles et réactives',
      chapeau: 'Des formules courtes, et la liste lisible avant l’achat.',
      intro:
        'Une peau réactive ne demande pas un produit miracle : elle demande de savoir ce qu’elle reçoit. Une formule courte n’est pas un argument de vente, c’est ce qui permet d’identifier le responsable quand quelque chose ne va pas.',
      sections: [
        {
          titre: 'Pourquoi une liste courte aide',
          corps:
            'Sur une formule de trente ingrédients, isoler celui qui provoque une réaction relève de la chance. Sur huit, c’est faisable. Nos soins visage tiennent le plus souvent entre six et douze ingrédients, et l’INCI complet figure sur chaque fiche produit — avant l’achat, pas dans le colis.',
        },
        {
          titre: 'Le parfum, premier suspect',
          corps:
            'Les huiles essentielles sont naturelles et restent la cause la plus fréquente d’irritation en cosmétique. Une peau réactive gagne à commencer par les produits sans parfum, quitte à en ajouter ensuite si tout se passe bien. « Naturel » ne veut pas dire « inoffensif », et prétendre le contraire serait vous desservir.',
        },
        {
          titre: 'Le test préalable, qui prend deux jours',
          corps:
            'Appliquez une petite quantité au pli du coude et attendez quarante-huit heures avant d’étendre à tout le visage. C’est fastidieux et c’est la seule méthode fiable. Nous le recommandons pour tout nouveau soin, y compris les nôtres.',
        },
      ],
      question: 'Vos produits conviennent-ils aux peaux atopiques ?',
      reponse:
        'Plusieurs de nos savons surgras et de nos soins sans parfum sont utilisés par des personnes à peau atopique, mais nous ne pouvons pas le garantir : l’atopie est une affection médicale et chaque peau y répond différemment. Demandez conseil en boutique, et parlez-en à votre dermatologue avant tout changement.',
    },
    en: {
      titre: 'Care for sensitive and reactive skin',
      chapeau: 'Short formulas, and a readable list before you buy.',
      intro:
        'Reactive skin does not need a miracle product: it needs to know what it is being given. A short formula is not a selling point — it is what lets you identify the culprit when something goes wrong.',
      sections: [
        {
          titre: 'Why a short list helps',
          corps:
            'On a thirty-ingredient formula, isolating the one that causes a reaction is largely luck. On eight, it is achievable. Our face products usually run between six and twelve ingredients, and the full INCI appears on every product page — before purchase, not in the parcel.',
        },
        {
          titre: 'Fragrance, the first suspect',
          corps:
            'Essential oils are natural and remain the most common cause of irritation in cosmetics. Reactive skin does well to start with fragrance-free products and add later if all goes well. “Natural” does not mean “harmless”, and pretending otherwise would not serve you.',
        },
        {
          titre: 'The patch test, which takes two days',
          corps:
            'Apply a small amount to the inner elbow and wait forty-eight hours before using it on your face. It is tedious and it is the only reliable method. We recommend it for any new product, ours included.',
        },
      ],
      question: 'Are your products suitable for atopic skin?',
      reponse:
        'Several of our superfatted soaps and fragrance-free products are used by people with atopic skin, but we cannot guarantee it: atopy is a medical condition and every skin responds differently. Ask us in the boutique, and speak to your dermatologist before any change.',
    },
    de: {
      titre: 'Pflege für empfindliche Haut',
      chapeau: 'Kurze Rezepturen und eine lesbare Liste vor dem Kauf.',
      intro:
        'Empfindliche Haut braucht kein Wundermittel, sondern die Gewissheit, was sie bekommt. Eine kurze Rezeptur ist kein Verkaufsargument — sie macht den Verursacher auffindbar.',
      sections: [
        {
          titre: 'Warum eine kurze Liste hilft',
          corps:
            'Bei dreissig Inhaltsstoffen ist das Auffinden des Auslösers Glückssache, bei acht ist es machbar. Unsere Gesichtspflege umfasst meist sechs bis zwölf Stoffe, die vollständige INCI steht auf jeder Produktseite.',
        },
        {
          titre: 'Duft, der erste Verdächtige',
          corps:
            'Ätherische Öle sind natürlich und bleiben die häufigste Ursache von Reizungen. „Natürlich“ heisst nicht „harmlos“.',
        },
        {
          titre: 'Der Test, der zwei Tage dauert',
          corps:
            'Eine kleine Menge in die Ellenbeuge geben und achtundvierzig Stunden warten. Mühsam, aber die einzige verlässliche Methode.',
        },
      ],
      question: 'Sind Ihre Produkte für atopische Haut geeignet?',
      reponse:
        'Mehrere unserer überfetteten Seifen werden von Menschen mit atopischer Haut verwendet, garantieren können wir es nicht: Atopie ist eine medizinische Erkrankung. Sprechen Sie vor einer Umstellung mit Ihrer Hautärztin oder Ihrem Hautarzt.',
    },
  },

  {
    slug: 'cadeaux-cosmetiques-naturels',
    rubrique: 'Cadeaux',
    image: '/premium_product_stone.png',
    fr: {
      titre: 'Cadeaux et coffrets à Genève',
      chapeau: 'À emporter aujourd’hui, emballé sur place.',
      intro:
        'Offrir un cosmétique est un pari : on ne connaît ni la peau ni les goûts de l’autre. Quelques repères réduisent le risque, et un bon cadeau le supprime tout à fait.',
      sections: [
        {
          titre: 'Ce qui se choisit sans se tromper',
          corps:
            'Un savon se trompe rarement : il s’utilise, il se finit, il n’encombre pas. Un accessoire durable — porte-savon, brosse, contenant — passe aussi bien parce qu’il ne dépend d’aucune peau. Les soins visage, eux, supposent de connaître la personne : mieux vaut alors le bon cadeau.',
        },
        {
          titre: 'Le bon cadeau, quand on ne sait pas',
          corps:
            'Il vaut un montant ou un atelier, il est valable un an, et il laisse le choix à celle ou celui qui le reçoit. C’est aussi la seule formule qui s’envoie le jour même quand on s’y prend tard.',
        },
        {
          titre: 'Emballage et retrait',
          corps:
            'L’emballage cadeau se demande à la commande. Le retrait en boutique est gratuit et se fait aux Eaux-Vives ; pour un envoi postal, comptez deux à trois jours ouvrables de préparation avant l’expédition.',
        },
      ],
      question: 'Peut-on offrir un atelier plutôt qu’un produit ?',
      reponse:
        'Oui. Le bon cadeau peut porter sur un atelier précis ou sur un montant libre. La personne réserve ensuite la date qui lui convient, selon les disponibilités.',
    },
    en: {
      titre: 'Gifts and gift sets in Geneva',
      chapeau: 'Take it home today, wrapped on the spot.',
      intro:
        'Giving cosmetics is a gamble: you know neither the skin nor the taste of the person receiving them. A few markers reduce the risk, and a gift card removes it entirely.',
      sections: [
        {
          titre: 'What is hard to get wrong',
          corps:
            'Soap rarely misses: it gets used, it gets finished, it does not clutter. A durable accessory — dish, brush, container — works too, because it depends on nobody’s skin. Face care assumes you know the person; a gift card is the better answer there.',
        },
        {
          titre: 'The gift card, when you are not sure',
          corps:
            'It carries an amount or a workshop, it is valid for a year, and it leaves the choice to whoever receives it. It is also the only option that can be sent the same day when you have left it late.',
        },
        {
          titre: 'Wrapping and collection',
          corps:
            'Gift wrapping is requested at checkout. Collection at the boutique is free, in Eaux-Vives; for postal delivery, allow two to three working days of preparation before dispatch.',
        },
      ],
      question: 'Can I give a workshop rather than a product?',
      reponse:
        'Yes. A gift card can cover a specific workshop or a free amount. The recipient then books whichever date suits them, subject to availability.',
    },
    de: {
      titre: 'Geschenke und Sets in Genf',
      chapeau: 'Heute mitnehmen, vor Ort verpackt.',
      intro:
        'Kosmetik zu verschenken ist ein Wagnis: Man kennt weder Haut noch Geschmack. Ein paar Anhaltspunkte verringern das Risiko, ein Gutschein beseitigt es.',
      sections: [
        {
          titre: 'Was selten danebengeht',
          corps:
            'Seife wird gebraucht und aufgebraucht. Ein langlebiges Zubehör passt ebenfalls, weil es von keiner Haut abhängt. Gesichtspflege setzt Kenntnis der Person voraus.',
        },
        {
          titre: 'Der Gutschein',
          corps:
            'Er lautet auf einen Betrag oder einen Kurs, gilt ein Jahr und überlässt die Wahl der beschenkten Person.',
        },
        {
          titre: 'Verpackung und Abholung',
          corps:
            'Geschenkverpackung wird bei der Bestellung angefragt. Die Abholung in der Boutique ist kostenlos.',
        },
      ],
      question: 'Kann man einen Kurs statt eines Produkts verschenken?',
      reponse:
        'Ja. Ein Gutschein kann auf einen bestimmten Kurs oder einen freien Betrag lauten.',
    },
  },

  {
    slug: 'matieres-premieres-cosmetiques',
    rubrique: 'DIY',
    image: '/workshop_ingredients.png',
    fr: {
      titre: 'Matières premières et matériel DIY',
      chapeau: 'Argiles, huiles, contenants et kits, au détail à Genève.',
      intro:
        'Fabriquer soi-même suppose de trouver de petites quantités d’ingrédients fiables. C’est précisément ce qui manque : les fournisseurs vendent au kilo, et personne ne veut d’un kilo de rhassoul pour essayer.',
      sections: [
        {
          titre: 'Au détail, parce que c’est le besoin réel',
          corps:
            'Nous vendons les argiles, poudres et huiles dans les quantités où l’on commence : de quoi faire quelques masques, pas de quoi ouvrir un laboratoire. Ce sont les mêmes matières que celles de notre atelier, prélevées sur les mêmes lots.',
        },
        {
          titre: 'Les contenants, qu’on oublie toujours',
          corps:
            'Une préparation maison sans conservateur se garde peu et supporte mal la lumière. Les pots et flacons adaptés — verre teinté, PET, avec fermeture correcte — comptent autant que les ingrédients. C’est le poste qu’on découvre au moment où la préparation est prête, et où il est trop tard.',
        },
        {
          titre: 'Les kits, pour un premier essai',
          corps:
            'Un kit réunit les matières, un contenant et une marche à suivre, dans des proportions déjà calculées. C’est la manière la moins coûteuse de savoir si l’exercice vous plaît avant d’acheter chaque ingrédient séparément.',
        },
      ],
      question: 'Faut-il un conservateur pour une préparation maison ?',
      reponse:
        'Dès qu’il y a de l’eau, oui. Une formule anhydre — huiles, beurres, poudres — se garde plusieurs mois. Dès qu’on ajoute de l’eau, un hydrolat ou un gel, la contamination bactérienne commence en quelques jours : soit on conserve, soit on prépare de petites quantités qu’on garde au frais et qu’on utilise dans la semaine.',
    },
    en: {
      titre: 'Raw materials and DIY supplies',
      chapeau: 'Clays, oils, containers and kits, sold by the unit in Geneva.',
      intro:
        'Making your own means finding small quantities of reliable ingredients. That is exactly what is missing: suppliers sell by the kilo, and nobody wants a kilo of rhassoul just to try.',
      sections: [
        {
          titre: 'By the unit, because that is the real need',
          corps:
            'We sell clays, powders and oils in the quantities you actually start with: enough for a few masks, not enough to open a laboratory. They are the same materials we use in our own workshop, taken from the same batches.',
        },
        {
          titre: 'Containers, always forgotten',
          corps:
            'A home preparation without preservative keeps poorly and dislikes light. Suitable jars and bottles — tinted glass, PET, with a proper closure — matter as much as the ingredients. It is the item you discover you need once the preparation is ready, and too late.',
        },
        {
          titre: 'Kits, for a first attempt',
          corps:
            'A kit brings together the materials, a container and a method, in proportions already worked out. It is the cheapest way to find out whether you enjoy the exercise before buying every ingredient separately.',
        },
      ],
      question: 'Do I need a preservative for a home preparation?',
      reponse:
        'As soon as there is water, yes. An anhydrous formula — oils, butters, powders — keeps for months. Add water, a hydrosol or a gel and bacterial contamination begins within days: either preserve it, or make small amounts, keep them cold and use them within the week.',
    },
    de: {
      titre: 'Rohstoffe und DIY-Material',
      chapeau: 'Tonerden, Öle, Gefässe und Sets, in kleinen Mengen in Genf.',
      intro:
        'Selbermachen setzt kleine Mengen verlässlicher Rohstoffe voraus. Genau daran fehlt es: Lieferanten verkaufen kiloweise.',
      sections: [
        {
          titre: 'In kleinen Mengen',
          corps:
            'Wir verkaufen Tonerden, Pulver und Öle in Mengen, mit denen man anfängt — dieselben Rohstoffe wie in unserem Atelier, aus denselben Chargen.',
        },
        {
          titre: 'Gefässe, die man immer vergisst',
          corps:
            'Eine Zubereitung ohne Konservierung hält schlecht und verträgt kein Licht. Passende Gefässe zählen so viel wie die Zutaten.',
        },
        {
          titre: 'Sets für den ersten Versuch',
          corps:
            'Ein Set vereint Rohstoffe, Gefäss und Anleitung in bereits berechneten Mengen.',
        },
      ],
      question: 'Braucht eine selbstgemachte Zubereitung ein Konservierungsmittel?',
      reponse:
        'Sobald Wasser enthalten ist, ja. Eine wasserfreie Rezeptur hält Monate; mit Wasser beginnt die Verkeimung binnen Tagen.',
    },
  },
];

export const SLUGS_FAMILLES = FAMILLES.map((f) => f.slug);

export function trouverFamille(slug) {
  return FAMILLES.find((f) => f.slug === slug) || null;
}

// Le contenu dans la langue demandée, avec repli sur le français : une famille
// dont la traduction manquerait doit rendre une page lisible, pas une page vide.
export function contenuFamille(famille, langue) {
  if (!famille) return null;
  return famille[langue] || famille.fr;
}
