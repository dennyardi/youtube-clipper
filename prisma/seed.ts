import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      openaiModel: process.env.DEFAULT_OPENAI_MODEL || "gpt-5.2",
      analysisMode: "HYBRID",
      maxAiCandidates: Number(process.env.MAX_AI_CANDIDATES || 40),
    },
  });

  const presets = [
    {
      name: "Viral & Komedi",
      description: "Fokus mencari momen lucu atau reaksi tak terduga.",
      prompt:
        "Fokus mencari momen lucu, reaksi spontan, kalimat mengejutkan, punchline, atau situasi yang terasa mudah dibagikan.",
    },
    {
      name: "Edukasi & Insight",
      description: "Fokus mencari pernyataan penting, data, atau core value.",
      prompt:
        "Fokus mencari pernyataan penting, data, insight praktis, core value, rangkuman tajam, atau penjelasan yang membuat penonton merasa mendapat manfaat.",
    },
    {
      name: "Drama & Konflik",
      description: "Fokus mencari perdebatan atau ketegangan.",
      prompt:
        "Fokus mencari perdebatan, perbedaan pendapat, konflik, ketegangan emosional, bantahan, atau bagian yang memancing rasa penasaran.",
    },
    {
      name: "Pengajian & Tausiah",
      description: "Fokus mencari nasihat agama, hikmah, dalil, dan pesan moral yang utuh.",
      prompt:
        "Fokus mencari bagian pengajian atau tausiah yang berisi nasihat agama, hikmah kehidupan, pesan moral, dalil, kisah teladan, peringatan, atau kesimpulan yang menyentuh. Pilih bagian yang konteksnya utuh dari awal pembahasan sampai pesan selesai, tidak memotong di tengah dalil, cerita, atau nasihat.",
    },
  ];

  for (const preset of presets) {
    await prisma.promptPreset.upsert({
      where: { name: preset.name },
      update: preset,
      create: preset,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
