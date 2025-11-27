pragma circom 2.0.0;

// Selects one of two state hashes based on a selector bit.
template DualStateSelect() {
    signal input state0;
    signal input state1;
    signal input selector; // 0 or 1
    signal output selected;

    // Ensure selector is boolean
    selector * selector === selector;

    selected <== state0 * (1 - selector) + state1 * selector;
}

component main = DualStateSelect();
