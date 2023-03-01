import * as fs from "fs";
import { beginCell, Cell, parseTuple } from "ton-core";
import { Blockchain, OpenedContract, TreasuryContract } from "@ton-community/sandbox";
import Onda from "./contract"; 
import { expect } from 'chai';
import {
        FlatTransaction,
        FlatTransactionComparable,
        flattenTransaction
} from './transaction';

import { packOracleResponse } from "./helper";
describe("onda-tokenPool tests", async () => {
        let blockchain = await Blockchain.create();
        let ondaContract: OpenedContract<Onda>;

        let deployer = await blockchain.treasury("deployer");

        let owner_address = await blockchain.treasury("owner_address");
        let jetton_wallet_x_address = await blockchain.treasury("jetton_wallet_x_address");
        let jetton_wallet_y_address = await blockchain.treasury("jetton_wallet_y_address");
        let jetton_wallet_otoken_address = await blockchain.treasury("jetton_wallet_otoken_address");
        let oracle = await blockchain.treasury("oracle");

        let user = await blockchain.treasury("user");
        let liquidator = await blockchain.treasury("liquidator");

        let ltv = 75,
        liquidationThreshold = 80,
        liquidationBonus = 5,
        borrowingEnabled = 1,
        isActive = 1,
        liquidityRate = 1900000000,
        variableBorrowRate = 3200000000

        let configuration = beginCell()
                .storeUint(ltv, 64)
                .storeUint(liquidationThreshold, 64)
                .storeUint(liquidationBonus, 64)
                .storeUint(borrowingEnabled, 64)
                .storeUint(isActive, 64)
                .storeUint(liquidityRate, 64)
                .storeUint(variableBorrowRate, 64)
        .endCell();

        describe("onda-tokenPool main tests", () => {
                beforeEach(async () =>  {
                        const ondaCode = Cell.fromBoc(fs.readFileSync("./output/pool/onda-TokenPool.cell"))[0]; // compilation output from tutorial 2
                        const onda = Onda.createForDeploy(ondaCode, jetton_wallet_x_address.address, jetton_wallet_y_address.address, jetton_wallet_otoken_address.address, oracle.address, owner_address.address, configuration);
                        ondaContract = blockchain.openContract(onda);
                        await ondaContract.sendDeploy(deployer.getSender());
                });

                it("onda-tokenPool newDepositXToken",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x186a1, 64)
                                .storeCoins(10*10**9)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                })

                it("onda-tokenPool check lend info",async () => {
                        var data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data)
                        expect(res.typeLendAmount).to.equal(1)
                        expect(res.status).to.equal(1)
                        expect(res.lendValue).to.equal(10000000000n)
                });

                it("onda-tokenPool newBorrow using x token",async () => {
                        const origBody = beginCell()
                                .storeUint(0x186a0, 32)
                                .storeUint(0, 64)
                        .endCell()
                        var body = await packOracleResponse(user.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                })

                it("onda-tokenPool check borrow info",async () => {
                        let data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data);
                        expect(res.typeBorrowAmount).to.equal(2)
                        expect(res.borrowValue).to.equal(18375000000n)
                });

                it("onda-tokenPool trying newDepositXToken when user alredy lend",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x186a1, 64)
                                .storeCoins(10*10**9)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(83)
                        expect(res.aborted).to.equal(true)
                });

                it("onda-tokenPool deleteBorrowYToken when hf < 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x15f90, 64)
                                .storeCoins(18375000000n)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_y_address.address, 1*10**9, 1.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(585)
                        expect(res.aborted).to.equal(true)
                });

                it("onda-tokenPool check borrow info",async () => {
                        let data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data);
                        expect(res.typeBorrowAmount).to.equal(2)
                        expect(res.borrowValue).to.equal(18375000000n)
                });  

                it("onda-tokenPool deleteBorrowYToken when hf > 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x15f90, 64)
                                .storeCoins(18375001891)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_y_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-tokenPool check lend info",async () => {
                        let data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data);
                        expect(res.typeLendAmount).to.equal(1)
                        expect(res.status).to.equal(1)
                        expect(res.lendValue).to.equal(10000000000n)
                });

                it("onda-tokenPool withdraw", async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x186a3, 64)
                                .storeCoins(10000000000)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_otoken_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-tokenPool check lend info",async () => {
                        var data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data)
                        expect(res.typeLendAmount).to.equal(0)
                        expect(res.status).to.equal(0)
                        expect(res.lendValue).to.equal(0n)
                });

                it("onda-tokenPool check borrow info",async () => {
                        var data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data)
                        expect(res.typeBorrowAmount).to.equal(0)
                        expect(res.borrowValue).to.equal(0n)
                });
                
                it("onda-tokenPool newDepositYToken",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x186a2, 64)
                                .storeCoins(10*10**9)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_y_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                })

                it("onda-tokenPool check lend info",async () => {
                        let data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data);
                        expect(res.typeLendAmount).to.equal(2)
                        expect(res.status).to.equal(1)
                        expect(res.lendValue).to.equal(10000000000n)
                });
                
                it("onda-tokenPool newBorrow using y token",async () => {
                        const origBody = beginCell()
                                .storeUint(0x186a0, 32)
                                .storeUint(0, 64)
                        .endCell()
                        var body = await packOracleResponse(user.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-tokenPool check borrow info",async () => {
                        let data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data);
                        expect(res.typeBorrowAmount).to.equal(1)
                        expect(res.borrowValue).to.equal(3061224489n)
                });  
                
                it("onda-tokenPool liquidationCallXToken when hf > 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x1adb0, 64)
                                .storeCoins(1530612244)
                                .storeAddress(liquidator.address)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 1*10**9, 1.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(585)
                        expect(res.aborted).to.equal(true)
                }); 

                it("onda-tokenPool liquidationCallXToken when hf < 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x1adb0, 64)
                                .storeCoins(1530612244)
                                .storeAddress(liquidator.address)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 1*10**9, 3.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-tokenPool check lend info",async () => {
                        var data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data)
                        expect(res.typeLendAmount).to.equal(0)
                        expect(res.status).to.equal(0)
                        expect(res.lendValue).to.equal(0n)
                });

                it("onda-tokenPool check borrow info",async () => {
                        var data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data)
                        expect(res.typeBorrowAmount).to.equal(0)
                        expect(res.borrowValue).to.equal(0n)
                });

                it("onda-tokenPool newDepositXToken",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x186a1, 64)
                                .storeCoins(10*10**9)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                })

                it("onda-tokenPool check lend info",async () => {
                        var data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data)
                        expect(res.typeLendAmount).to.equal(1)
                        expect(res.status).to.equal(1)
                        expect(res.lendValue).to.equal(10000000000n)
                });

                it("onda-tokenPool newBorrow using x token",async () => {
                        const origBody = beginCell()
                                .storeUint(0x186a0, 32)
                                .storeUint(0, 64)
                        .endCell()
                        var body = await packOracleResponse(user.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                })

                it("onda-tokenPool check borrow info",async () => {
                        let data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data);
                        expect(res.typeBorrowAmount).to.equal(2)
                        expect(res.borrowValue).to.equal(18375000000n)
                });

                it("onda-tokenPool liquidationCallYToken when hf > 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x1abb1, 64)
                                .storeCoins(9187500000)
                                .storeAddress(liquidator.address)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_y_address.address, 1*10**9, 3.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(585)
                        expect(res.aborted).to.equal(true)
                }); 

                it("onda-tokenPool liquidationCallYToken when hf < 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x1abb1, 64)
                                .storeCoins(9187500000)
                                .storeAddress(liquidator.address)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_y_address.address, 1*10**9, 1.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-tokenPool check lend info",async () => {
                        var data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data)
                        expect(res.typeLendAmount).to.equal(0)
                        expect(res.status).to.equal(0)
                        expect(res.lendValue).to.equal(0n)
                });

                it("onda-tokenPool check borrow info",async () => {
                        var data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data)
                        expect(res.typeBorrowAmount).to.equal(0)
                        expect(res.borrowValue).to.equal(0n)
                });

                it("onda-tokenPool newDepositYToken",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x186a2, 64)
                                .storeCoins(10*10**9)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_y_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                })

                it("onda-tokenPool check lend info",async () => {
                        let data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data);
                        expect(res.typeLendAmount).to.equal(2)
                        expect(res.status).to.equal(1)
                        expect(res.lendValue).to.equal(10000000000n)
                });
                
                it("onda-tokenPool newBorrow using y token",async () => {
                        const origBody = beginCell()
                                .storeUint(0x186a0, 32)
                                .storeUint(0, 64)
                        .endCell()
                        var body = await packOracleResponse(user.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-tokenPool check borrow info",async () => {
                        let data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data);
                        expect(res.typeBorrowAmount).to.equal(1)
                        expect(res.borrowValue).to.equal(3061224489n)
                });  

                it("onda-tokenPool deleteBorrowXToken when hf < 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x15ba8, 64)
                                .storeCoins(18375000000n)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 1*10**9, 3.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(585)
                        expect(res.aborted).to.equal(true)
                });

                it("onda-tokenPool check borrow info",async () => {
                        let data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data);
                        expect(res.typeBorrowAmount).to.equal(1)
                        expect(res.borrowValue).to.equal(3061224489n)
                });  

                it("onda-tokenPool deleteBorrowXToken when hf > 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x15ba8, 64)
                                .storeCoins(18375000000n)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 1*10**9, 1.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-tokenPool check borrow info",async () => {
                        var data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data)
                        expect(res.typeBorrowAmount).to.equal(0)
                        expect(res.borrowValue).to.equal(0n)
                });

                it("onda-tokenPool check lend info",async () => {
                        let data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data);
                        expect(res.typeLendAmount).to.equal(2)
                        expect(res.status).to.equal(1)
                        expect(res.lendValue).to.equal(10000000000n)
                });

                it("onda-tokenPool withdraw", async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x186a3, 64)
                                .storeCoins(10000000000)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_otoken_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-tokenPool check lend info",async () => {
                        var data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data)
                        expect(res.typeLendAmount).to.equal(0)
                        expect(res.status).to.equal(0)
                        expect(res.lendValue).to.equal(0n)
                });

        });
});