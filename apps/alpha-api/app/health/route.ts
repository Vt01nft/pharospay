export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    service: "pharos-alpha",
    paid: "/alpha/wallet/:address",
    price: process.env.ALPHA_PRICE ?? "0.01",
    network: process.env.PHAROS_NETWORK ?? "pharos-testnet",
  });
}
