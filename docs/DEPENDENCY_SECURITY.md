# Sécurité des dépendances

## Exception React Router

Le 30 juillet 2026, le frontend utilise `react-router-dom` 7.18.2.
`npm audit` signale l’avis
[GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2).

L’avis officiel précise que la vulnérabilité concerne uniquement les API RSC
instables. Fiscora est une application monopage Vite utilisant
`createBrowserRouter`. Elle n’active ni RSC, ni Server Actions React Router.
Cette vulnérabilité n’est donc pas exploitable dans l’architecture actuelle.

La version corrigée annoncée, `react-router` 8.3.0, exige Node.js 22.22 ou
supérieur et React 19.2.7 ou supérieur. Elle n’est pas encore publiée sous la
forme d’une version correspondante de `react-router-dom`.

Le script `npm run audit:prod` accepte uniquement cet avis et échoue si npm
détecte toute autre vulnérabilité de sévérité modérée ou supérieure. Cette
exception doit être supprimée lors de la migration vers une version corrigée
compatible.
