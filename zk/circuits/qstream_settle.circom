pragma circom 2.0.0;

// Computes owedAmount = ratePerSecond * elapsedTime
// This is a placeholder circuit representing Q-Stream settlement.
template QStreamSettle() {
    signal input ratePerSecond;
    signal input elapsedTime;
    signal output owedAmount;

    owedAmount <== ratePerSecond * elapsedTime;
}

component main = QStreamSettle();
