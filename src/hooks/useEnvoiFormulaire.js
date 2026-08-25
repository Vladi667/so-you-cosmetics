import { useState, useEffect, useCallback } from 'react';

// L'état d'un formulaire qui part vers le serveur.
//
// Les deux formulaires du site affichaient leur confirmation DANS le `catch`,
// avec le commentaire qui l'assumait : « show success anyway ». Une panne réseau
// donnait donc « ✓ Envoyé ! » et le message était perdu. Personne ne réessayait,
// puisque le site venait de dire que c'était parti.
//
// Trois choses sont réglées ici, une fois pour les deux formulaires : le succès
// ne s'affiche que sur un succès ; le bouton est bloqué pendant la requête ; et
// il est débloqué dans les DEUX issues — sans quoi un premier échec réseau le
// laisse inerte pour le reste de la visite.
export default function useEnvoiFormulaire({ succesMs = 4000, erreurMs = 6000 } = {}) {
  const [etat, setEtat] = useState('repos'); // repos | envoi | ok | erreur

  // Quel message a été montré en dernier. Il n'est jamais remis à zéro : une
  // fois affiché, le paragraphe reste dans la page et c'est son opacité qui le
  // fait disparaître. Le démonter dès la fin du délai ne laisserait rien à
  // animer, et le faire disparaître d'un coup se lit comme un sursaut.
  const [message, setMessage] = useState(null); // 'ok' | 'erreur' | null

  // Le message s'efface seul. La minuterie est nettoyée au démontage : sans
  // cela, quitter la page pendant l'attente fait écrire dans un composant parti.
  useEffect(() => {
    if (etat !== 'ok' && etat !== 'erreur') return undefined;
    const minuterie = setTimeout(() => setEtat('repos'), etat === 'ok' ? succesMs : erreurMs);
    return () => clearTimeout(minuterie);
  }, [etat, succesMs, erreurMs]);

  // Reçoit la promesse de la requête. Une réponse HTTP en erreur est un échec :
  // `fetch` ne rejette que sur panne réseau, un 500 arrive ici avec ok === false
  // et serait autrement pris pour un succès.
  const envoyer = useCallback((promesse, { surSucces } = {}) => {
    setEtat('envoi');
    return promesse
      .then((res) => {
        if (res && res.ok === false) throw new Error('HTTP ' + res.status);
        setMessage('ok');
        setEtat('ok');
        if (surSucces) surSucces();
      })
      .catch((err) => {
        console.warn("L'envoi du formulaire a échoué :", err);
        setMessage('erreur');
        setEtat('erreur');
      });
  }, []);

  return {
    etat,
    enCours: etat === 'envoi',
    message,
    messageVisible: etat === 'ok' || etat === 'erreur',
    envoyer,
  };
}
