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
describe("onda-nativePool tests", async () => {
        let blockchain = await Blockchain.create();
        let ondaContract: OpenedContract<Onda>;

        let deployer = await blockchain.treasury("deployer");

        let owner_address = await blockchain.treasury("owner_address");
        let jetton_wallet_x_address = await blockchain.treasury("jetton_wallet_x_address");
        let minter_otoken_address = await blockchain.treasury("minter_otoken_address");
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

        describe("onda-nativePool main tests", () => {
                beforeEach(async () =>  {
                        const ondaCode = Cell.fromBoc(fs.readFileSync("./output/pool/onda-nativePool.cell"))[0]; // compilation output from tutorial 2
                        const onda = Onda.createForDeploy(ondaCode, jetton_wallet_x_address.address, minter_otoken_address.address, jetton_wallet_otoken_address.address, oracle.address, owner_address.address, configuration);
                        ondaContract = blockchain.openContract(onda);
                        await ondaContract.sendDeploy(deployer.getSender());
                });
                it("onda-nativePool newLendNativeToken",async () => {
                        const origBody = beginCell()
                                .storeUint(0x186a1, 32)
                                .storeUint(0, 64)
                        .endCell()
                        var body = await packOracleResponse(user.address, 10*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                })

                it("onda-nativePool check lend info",async () => {
                        let data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data);
                        //console.log(res);
                });

                it("onda-nativePool newBorrow using native token",async () => {
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

                it("onda-nativePool check borrow info",async () => {
                        let data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data);
                        //console.log(res);
                });

                it("onda-nativePool trying withdraw when borrow not end", async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x15f90, 64)
                                .storeCoins(10000000000)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_otoken_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(7006)
                        expect(res.aborted).to.equal(true)
                });

                it("onda-nativePool trying newLendNativeToken when user alredy lend",async () => {
                        const origBody = beginCell()
                                .storeUint(0x186a1, 32)
                                .storeUint(0, 64)
                        .endCell()
                        var body = await packOracleResponse(user.address, 10*10**9, 2.40*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(83)
                        expect(res.aborted).to.equal(true)
                });

                it("onda-nativePool deleteBorrowCustomToken when hf < 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x1adb0, 64)
                                .storeCoins(18375000000)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 1*10**9, 1.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(585)
                        expect(res.aborted).to.equal(true)
                });

                it("onda-nativePool check borrow info",async () => {
                        let data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data);
                        expect(res.typeBorrowAmount).to.equal(1)
                        expect(res.borrowValue).to.equal(18375000000n)
                });                
                it("onda-nativePool deleteBorrowCustomToken when hf > 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x1adb0, 64)
                                .storeCoins(18375001891)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-nativePool check lend info",async () => {
                        let data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data);
                        expect(res.typeLendAmount).to.equal(2)
                        expect(res.status).to.equal(1)
                        expect(res.lendValue).to.equal(10000000000n)
                });

                it("onda-nativePool withdraw", async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x15f90, 64)
                                .storeCoins(10000000000)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_otoken_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-nativePool newLendCustomToken",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x15ba8, 64)
                                .storeCoins(10000000000)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 10*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-nativePool check lend info",async () => {
                        let data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data);
                        expect(res.typeLendAmount).to.equal(1)
                        expect(res.status).to.equal(1)
                        expect(res.lendValue).to.equal(10000000000n)
                });

                it("onda-nativePool newBorrow using custom token",async () => {
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
                it("onda-nativePool check borrow info",async () => {
                        let data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data);
                        expect(res.typeBorrowAmount).to.equal(2)
                        expect(res.borrowValue).to.equal(3061224489n)
                });  
                it("onda-nativePool liquidationCallNativeToken when hf > 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x186a3, 32)
                                .storeUint(0, 64)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(liquidator.address, 1530612244, 1.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(585)
                        expect(res.aborted).to.equal(true)
                }); 
                it("onda-nativePool liquidationCallNativeToken when hf < 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x186a3, 32)
                                .storeUint(0, 64)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(liquidator.address, 1530612244, 3.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-nativePool check lend info",async () => {
                        var data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data)
                        expect(res.typeLendAmount).to.equal(0)
                        expect(res.status).to.equal(0)
                        expect(res.lendValue).to.equal(0n)
                });

                it("onda-nativePool check borrow info",async () => {
                        var data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data)
                        expect(res.typeBorrowAmount).to.equal(0)
                        expect(res.borrowValue).to.equal(0n)
                });


                it("onda-nativePool newLendNativeToken",async () => {
                        const origBody = beginCell()
                                .storeUint(0x186a1, 32)
                                .storeUint(0, 64)
                        .endCell()
                        var body = await packOracleResponse(user.address, 10*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                })

                it("onda-nativePool newBorrow using native token",async () => {
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

                it("onda-nativePool check borrow info",async () => {
                        let data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data);
                        //console.log(res);
                });

                it("onda-nativePool liquidationCallCustomToken when hf > 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x1abb0, 64)
                                .storeCoins(1530612244)
                                .storeAddress(liquidator.address)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 1*10**9, 3.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(585)
                        expect(res.aborted).to.equal(true)
                }); 

                it("onda-nativePool liquidationCallCustomToken when hf < 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x1abb0, 64)
                                .storeCoins(9187500000)
                                .storeAddress(liquidator.address)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 1*10**9, 1.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-nativePool check lend info",async () => {
                        var data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data)
                        expect(res.typeLendAmount).to.equal(0)
                        expect(res.status).to.equal(0)
                        expect(res.lendValue).to.equal(0n)
                });

                it("onda-nativePool check borrow info",async () => {
                        var data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data)
                        expect(res.typeBorrowAmount).to.equal(0)
                        expect(res.borrowValue).to.equal(0n)
                });

                it("onda-nativePool newLendCustomToken",async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x15ba8, 64)
                                .storeCoins(10000000000)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_x_address.address, 10*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-nativePool check lend info",async () => {
                        let data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data);
                        expect(res.typeLendAmount).to.equal(1)
                        expect(res.status).to.equal(1)
                        expect(res.lendValue).to.equal(10000000000n)
                });

                it("onda-nativePool newBorrow using custom token",async () => {
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

                it("onda-nativePool check borrow info",async () => {
                        var data = await ondaContract.getBorrowInfo(user.address);
                        var res = await ondaContract.parseBorrowSlice(data)
                        //console.log(res)
                });

                it("onda-nativePool deleteBorrowNativeToken when hf < 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x186a2, 32)
                                .storeUint(0, 64)
                        .endCell()
                        var body = await packOracleResponse(user.address, 3061224489, 3.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(585)
                        expect(res.aborted).to.equal(true)
                });

                it("onda-nativePool deleteBorrowNativeToken when hf > 100",async () => {
                        const origBody = beginCell()
                                .storeUint(0x186a2, 32)
                                .storeUint(0, 64)
                        .endCell()
                        var body = await packOracleResponse(user.address, 3061224799, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

                it("onda-nativePool check lend info",async () => {
                        let data = await ondaContract.getLendInfo(user.address);
                        var res = await ondaContract.parseLendSlice(data);
                        expect(res.typeLendAmount).to.equal(1)
                        expect(res.status).to.equal(1)
                        expect(res.lendValue).to.equal(10000000000n)
                });

                it("onda-nativePool withdraw", async () => {
                        const origBody = beginCell()
                                .storeUint(0x7362d09c, 32)
                                .storeUint(0x15f90, 64)
                                .storeCoins(10000000000)
                                .storeAddress(user.address)
                        .endCell()
                        var body = await packOracleResponse(jetton_wallet_otoken_address.address, 1*10**9, 2.45*10**9, origBody);
                        var result = await ondaContract.sendAction(oracle.getSender(), body);
                        var res = flattenTransaction(result.transactions[1]);
                        expect(res.exitCode).to.equal(0)
                        expect(res.aborted).to.equal(false)
                });

        });
});