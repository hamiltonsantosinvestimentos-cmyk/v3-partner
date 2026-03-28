"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, TrendingDown, DollarSign, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function ConsorcioSimulacaoPage() {
  const [creditValue, setCreditValue] = useState(300000);
  const [months, setMonths] = useState(180);
  const [adminRate, setAdminRate] = useState(18);
  const [reserveFund, setReserveFund] = useState(2);

  // Calculations
  const totalAdmin = (creditValue * adminRate) / 100;
  const totalReserve = (creditValue * reserveFund) / 100;
  const totalAmount = creditValue + totalAdmin + totalReserve;
  const monthlyPayment = totalAmount / months;
  const effectiveRate = (totalAdmin / creditValue) * 100;
  const yearlyRate = effectiveRate / (months / 12);

  const formatInput = (val: number) => val.toLocaleString("pt-BR");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Simulação de Consórcio</h1>
          <p className="text-xs text-muted-foreground">
            Compare condições e calcule o custo real
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Input form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Parâmetros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Valor do Crédito
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={50000}
                  max={5000000}
                  step={10000}
                  value={creditValue}
                  onChange={(e) => setCreditValue(Number(e.target.value))}
                  className="flex-1 accent-[#1B4FD8]"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>R$ 50K</span>
                <span className="text-lg font-bold text-white">
                  {formatCurrency(creditValue)}
                </span>
                <span>R$ 5M</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Prazo (meses)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={12}
                  max={240}
                  step={12}
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="flex-1 accent-[#1B4FD8]"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>12 meses</span>
                <span className="text-lg font-bold text-white">
                  {months} meses ({Math.round(months / 12)} anos)
                </span>
                <span>240 meses</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Taxa de Administração (% total)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={8}
                  max={30}
                  step={0.5}
                  value={adminRate}
                  onChange={(e) => setAdminRate(Number(e.target.value))}
                  className="flex-1 accent-[#1B4FD8]"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>8%</span>
                <span className="text-lg font-bold text-amber-400">
                  {adminRate}% ao total
                </span>
                <span>30%</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fundo de Reserva (% total)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={reserveFund}
                  onChange={(e) => setReserveFund(Number(e.target.value))}
                  className="flex-1 accent-[#1B4FD8]"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span className="text-lg font-bold text-white">
                  {reserveFund}%
                </span>
                <span>5%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          <Card className="border-[#1B4FD8]/30 bg-[#1B4FD8]/5">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Parcela Mensal
              </p>
              <p className="text-4xl font-bold text-white">
                {formatCurrency(monthlyPayment)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                por {months} meses
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  <p className="text-xs text-muted-foreground">Taxa Admin</p>
                </div>
                <p className="text-lg font-bold text-amber-400">
                  {formatCurrency(totalAdmin)}
                </p>
                <p className="text-xs text-muted-foreground">{adminRate}% do crédito</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-muted-foreground">Fundo Reserva</p>
                </div>
                <p className="text-lg font-bold text-blue-400">
                  {formatCurrency(totalReserve)}
                </p>
                <p className="text-xs text-muted-foreground">{reserveFund}% do crédito</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                  <p className="text-xs text-muted-foreground">Custo Efetivo Total</p>
                </div>
                <p className="text-lg font-bold text-emerald-400">
                  {formatCurrency(totalAmount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Economia vs. financiamento*
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-muted-foreground">Taxa Anual Efetiva</p>
                </div>
                <p className="text-lg font-bold text-purple-400">
                  {yearlyRate.toFixed(2)}% a.a.
                </p>
                <p className="text-xs text-muted-foreground">Equivalente anual</p>
              </CardContent>
            </Card>
          </div>

          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <p className="text-xs text-amber-400">
              <strong>Atenção:</strong> Esta é uma simulação simplificada. O valor real das parcelas
              pode variar conforme reajuste do crédito, seguros e outras taxas do grupo.
              O resultado da contemplação depende de sorteio ou lance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
