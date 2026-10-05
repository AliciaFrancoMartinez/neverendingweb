/*
  MY FILE DRAWER — tus proyectos abandonados (pestaña principal de la página).
  Se muestran tal cual, sin pasar por Supabase. Añade un bloque { … } por proyecto:

    title           título corto
    topic           campo o tema (sale en la pestaña de la carpeta)
    stage           dónde se paró: "idea" | "planning" | "data" | "analysis" | "writing" | "other"
    abandoned_year  año en que lo dejaste
    description     su historia (puedes usar saltos de línea con \n)
    id              (opcional) id de la fila en Supabase, para que no salga también en el de la comunidad
*/
window.MY_DRAWER = [
  {
    id: "ac85f1db-e414-487c-aece-9d7169cc5aab",
    title: "Counterintuitive",
    topic: "experimental",
    stage: "analysis",
    abandoned_year: 2025,
    description: "We were interested in the relationship between intuition measured with a questionnaire and a behavioral measure of unconscious processing, but the questionnaire data were a mess and any storyline sounded too weak to be worth telling.",
  },
  {
    id: "a1eb83d7-9408-43fa-9d2f-7760a4d8ada6",
    title: "Bayesian model of awareness",
    topic: "experimental",
    stage: "planning",
    abandoned_year: 2024,
    description: "We planned to adapt a model we had to Bayesian statistics.",
  },
  {
    id: "069c1319-7c36-4e95-8487-23a982fac6e2",
    title: "The Seven Wonderings",
    topic: "psychometrics",
    stage: "writing",
    abandoned_year: 2023,
    description: "One of the first works to approach how GPT could aid in psychometrics tasks",
  },
  {
    id: "0ede80b0-cc81-4f46-b6d2-890ddf12cf17",
    title: "Bifactor structures",
    topic: "psychometrics",
    stage: "planning",
    abandoned_year: 2022,
    description: "Some simulations about bifactor models",
  },
  {
    id: "af384515-9a3e-458d-a549-27d46e6299a9",
    title: "Pears or apples?",
    topic: "social psychology",
    stage: "data",
    abandoned_year: 2021,
    description: "We designed a situational judgement test to measure sexism and other discriminatory beliefs, but the project got stuck after the piloting.",
  },
];
