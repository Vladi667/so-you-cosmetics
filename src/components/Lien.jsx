import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { separerLangue, avecLangue } from '../i18n/routes';

// Un lien qui reste dans la langue de la page.
//
// Sans lui, chaque <Link to="/about"> ramènerait un visiteur anglophone au
// français au premier clic : la langue est désormais dans l'adresse, et une
// adresse écrite en dur n'en porte aucune.
//
// La langue est lue du chemin courant plutôt que du contexte de traduction :
// c'est la même source que celle qui décide du rendu, et elle évite de faire
// dépendre un composant de présentation d'un contexte qui, lui, dépend déjà de
// l'adresse.
//
// `to` s'écrit toujours sans préfixe — « /about », « /category/Savons » — et
// c'est ce composant qui le pose. Les adresses absolues (mailto:, https:) et
// les ancres passent inchangées.
const Lien = ({ to, children, ...reste }) => {
  const { pathname } = useLocation();
  const { langue } = separerLangue(pathname);

  const cible = typeof to === 'string' && to.startsWith('/')
    ? avecLangue(to, langue)
    : to;

  return <Link to={cible} {...reste}>{children}</Link>;
};

export default Lien;
