import { dayIndex } from "./utc-day";
import type { GeneratedQuestion, QuestionKind } from "./types";

/**
 * The safety net: a small hand-checked bank used only when the gateway is down
 * or keeps returning something unusable. The ritual breaks if a day has no
 * question, so there is always one.
 *
 * ⚠️  AGENT-DRAFTED, PENDING REVIEW. These are effectively published content —
 * they appear on the public question-of-the-day page on any day the generator
 * fails. Edit or replace them freely; the only rule is that every entry must
 * have both locales, and knowledge entries must carry an answer and explanation.
 */

export type FallbackQuestion = GeneratedQuestion & { kind: QuestionKind };

export const FALLBACK_QUESTIONS: FallbackQuestion[] = [
  {
    kind: "knowledge",
    category: "Astrophysics",
    difficulty: "easy",
    prompt: {
      en: "Roughly how long does light from the Sun take to reach Earth?",
      id: "Kira-kira berapa lama cahaya Matahari sampai ke Bumi?",
    },
    answer: {
      en: "About 8 minutes and 20 seconds. The Sun is roughly 150 million kilometres away, and light travels at just under 300,000 km per second, so sunlight always shows you the Sun as it was over eight minutes ago.",
      id: "Sekitar 8 menit 20 detik. Jarak Matahari kira-kira 150 juta kilometer dan cahaya melaju hampir 300.000 km per detik, jadi sinar Matahari selalu menunjukkan kondisi Matahari lebih dari delapan menit yang lalu.",
    },
  },
  {
    kind: "knowledge",
    category: "Biology",
    difficulty: "easy",
    prompt: {
      en: "Why does blood look red?",
      id: "Mengapa darah berwarna merah?",
    },
    answer: {
      en: "Because of haemoglobin, the iron-containing protein in red blood cells that carries oxygen. Oxygen binding changes the shape of the haem group, which absorbs green light and reflects red — so oxygen-rich blood is bright red and oxygen-poor blood is darker.",
      id: "Karena hemoglobin, protein berzat besi dalam sel darah merah yang mengangkut oksigen. Ikatan oksigen mengubah bentuk gugus heme sehingga menyerap cahaya hijau dan memantulkan merah — darah kaya oksigen berwarna merah terang, yang miskin oksigen lebih gelap.",
    },
  },
  {
    kind: "knowledge",
    category: "Earth science",
    difficulty: "medium",
    prompt: {
      en: "What actually causes the seasons?",
      id: "Apa sebenarnya penyebab pergantian musim?",
    },
    answer: {
      en: "Earth's axial tilt of about 23.4 degrees, not its distance from the Sun. As Earth orbits, each hemisphere leans toward or away from the Sun in turn, changing how directly sunlight strikes it and how long the days are. Earth is in fact closest to the Sun during northern winter.",
      id: "Kemiringan sumbu Bumi sekitar 23,4 derajat, bukan jaraknya dari Matahari. Saat Bumi mengorbit, tiap belahan bergantian condong ke arah atau menjauh dari Matahari sehingga sudut datang sinar dan panjang hari berubah. Bumi justru paling dekat dengan Matahari saat musim dingin di belahan utara.",
    },
  },
  {
    kind: "knowledge",
    category: "Mathematics",
    difficulty: "medium",
    prompt: {
      en: "Why is 1 not considered a prime number?",
      id: "Mengapa 1 tidak dianggap bilangan prima?",
    },
    answer: {
      en: "Because a prime is defined as a number with exactly two distinct divisors, and 1 has only one. Excluding it also keeps the fundamental theorem of arithmetic clean: if 1 were prime, every number would have infinitely many prime factorisations instead of one unique factorisation.",
      id: "Karena bilangan prima didefinisikan punya tepat dua pembagi berbeda, sedangkan 1 hanya punya satu. Pengecualian ini juga menjaga teorema dasar aritmetika: bila 1 prima, setiap bilangan akan punya tak hingga pemfaktoran prima, bukan satu pemfaktoran tunggal.",
    },
  },
  {
    kind: "knowledge",
    category: "Technology",
    difficulty: "hard",
    prompt: {
      en: "Why does a computer store negative integers in two's complement?",
      id: "Mengapa komputer menyimpan bilangan bulat negatif dalam komplemen dua?",
    },
    answer: {
      en: "So that subtraction needs no special circuitry. The same binary adder that handles addition also handles subtraction once the subtrahend is complemented, because the carry that falls off the top of the fixed-width word is simply discarded. It also avoids the two zeros that sign-magnitude encoding produces.",
      id: "Agar pengurangan tidak butuh rangkaian khusus. Penjumlah biner yang sama bisa menangani pengurangan setelah pengurang dikomplemenkan, karena bit carry yang keluar dari lebar word tetap dibuang. Cara ini juga menghindari dua representasi nol seperti pada sign-magnitude.",
    },
  },
  {
    kind: "reflective",
    category: null,
    difficulty: null,
    prompt: {
      en: "What is something you changed your mind about this year, and what changed it?",
      id: "Apa hal yang kamu ubah pikiranmu tahun ini, dan apa yang membuatmu berubah?",
    },
    answer: null,
  },
  {
    kind: "reflective",
    category: null,
    difficulty: null,
    prompt: {
      en: "Describe a small, ordinary moment from this week that you would happily live again.",
      id: "Ceritakan satu momen kecil dan biasa dari minggu ini yang ingin kamu alami lagi.",
    },
    answer: null,
  },
  {
    kind: "reflective",
    category: null,
    difficulty: null,
    prompt: {
      en: "What does a good Sunday look like for you now, compared with a few years ago?",
      id: "Seperti apa hari Minggu yang baik bagimu sekarang, dibanding beberapa tahun lalu?",
    },
    answer: null,
  },
  {
    kind: "reflective",
    category: null,
    difficulty: null,
    prompt: {
      en: "What is something you are quietly proud of that nobody has noticed?",
      id: "Apa hal yang diam-diam kamu banggakan tetapi tidak ada yang menyadarinya?",
    },
    answer: null,
  },
  {
    kind: "reflective",
    category: null,
    difficulty: null,
    prompt: {
      en: "If tomorrow had no obligations at all, what would you actually do with it?",
      id: "Kalau besok sama sekali tidak ada kewajiban, sebenarnya kamu akan melakukan apa?",
    },
    answer: null,
  },
];

export function fallbackBankFor(kind: QuestionKind) {
  return FALLBACK_QUESTIONS.filter((question) => question.kind === kind);
}

/**
 * Deterministic: the same date always yields the same fallback, so two members
 * who both hit a failed generation still see one identical question. Cycles
 * through the bank rather than repeating randomly.
 */
export function pickFallbackQuestion(
  kind: QuestionKind,
  date: string,
): GeneratedQuestion {
  const bank = fallbackBankFor(kind);

  if (bank.length === 0) {
    throw new Error(`No fallback questions defined for kind "${kind}".`);
  }

  const index = ((dayIndex(date) % bank.length) + bank.length) % bank.length;
  const { prompt, category, difficulty, answer } = bank[index];

  return { prompt, category, difficulty, answer };
}

/** `true` when every bank entry is complete and both locales are populated. */
export function fallbackBankProblems(): string[] {
  const problems: string[] = [];

  for (const [index, question] of FALLBACK_QUESTIONS.entries()) {
    const where = `#${index} (${question.kind})`;

    for (const locale of ["en", "id"] as const) {
      if (!question.prompt[locale]?.trim()) {
        problems.push(`${where}: missing ${locale} prompt`);
      }
    }

    if (question.kind === "knowledge") {
      if (!question.answer?.en?.trim() || !question.answer?.id?.trim()) {
        problems.push(`${where}: knowledge entry without a bilingual answer`);
      }
      if (!question.category)
        problems.push(`${where}: knowledge entry without a category`);
      if (!question.difficulty)
        problems.push(`${where}: knowledge entry without a difficulty`);
    }

    if (question.kind === "reflective" && question.answer) {
      problems.push(`${where}: reflective entry must not carry an answer`);
    }
  }

  return problems;
}
