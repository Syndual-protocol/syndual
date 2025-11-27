// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DualStateEngine is Ownable {
    struct DualState {
        bytes32 state0;
        bytes32 state1;
        uint64 createdAt;
    }

    mapping(bytes32 => DualState) private dualStates;
    mapping(address => bool) public controllers;

    event DualStateSet(bytes32 indexed key, bytes32 state0, bytes32 state1, uint64 createdAt);
    event DualStateFinalized(bytes32 indexed key, uint8 indexed chosenIndex, bytes32 chosenState);
    event ControllerUpdated(address indexed controller, bool allowed);

    constructor(address owner_) Ownable(owner_) {}

    modifier onlyController() {
        require(msg.sender == owner() || controllers[msg.sender], "not controller");
        _;
    }

    function setController(address controller, bool allowed) external onlyOwner {
        controllers[controller] = allowed;
        emit ControllerUpdated(controller, allowed);
    }

    function setDualState(bytes32 key, bytes32 state0, bytes32 state1) external onlyController {
        uint64 timestamp = uint64(block.timestamp);
        dualStates[key] = DualState({state0: state0, state1: state1, createdAt: timestamp});
        emit DualStateSet(key, state0, state1, timestamp);
    }

    function finalizeState(bytes32 key, uint8 chosenStateIndex) external view returns (bytes32) {
        require(chosenStateIndex < 2, "invalid index");
        DualState memory ds = dualStates[key];
        require(ds.createdAt != 0, "dual state missing");
        return chosenStateIndex == 0 ? ds.state0 : ds.state1;
    }

    function getDualState(bytes32 key) external view returns (DualState memory) {
        return dualStates[key];
    }
}
