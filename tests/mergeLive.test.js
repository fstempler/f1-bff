import { expect, test, describe } from '@jest/globals';
import { adaptDrivers, mergeLive } from '../src/services/adapters';

describe('mergeLive - leaderboard eriquecido', () => {
    test('calcula todos los campos requeridos', () => {
        // Drivers base
        const driversRaw = [
            { driver_number: 1, full_name: 'Max Verstappen', team_name: 'Red Bull Racing', driver_code: 'VER', team_colour: '3671C6 '},
            { driver_number: 16, full_name: 'Charles Leclerc', team_name: 'Ferrari', driver_code: 'LEC', team_colour: 'E6002B' }
        ];
        const drivers = adaptDrivers(driversRaw);

        // Positions
        const positions = [
            { driver_number: 1, position: 1, date: '2025-08-21T12:00:02Z' },
            { driver_number: 16, position: 2, date: '2025-08-21T12:00:02Z' }
        ];

        //Laps
        const laps = [
            { driver_number: 1, lap_number: 25, lap_duration: 80.123, date: '2025-08-21T11:59:30Z' },
            { driver_number: 1, lap_number: 26, lap_duration: 80.200, date: '2025-08-21T12:00:00Z' },
            { driver_number: 16, lap_number: 25, lap_duration: 80.500, date: '2025-08-21T12:00:00Z' }
        ];
        
        //Pits
        const pits = [
            { driver_number: 16, date: '2025-08-21T11:30:00Z' },
            { driver_number: 16, date: '2025-08-21T11:55:00Z' }
        ];

        //Intervals
        const intervals = [
            { driver_number: 1, gap_to_leader: null, date: '2025-08-21T12:00:02Z' },
            { driver_number: 16, gap_to_leader: '5.432', date: '2025-08-21T12:00:02Z' }
        ];

        //Stints
        const stints = [
            { driver_number: 1, lap_start: 20, lap_end: null, compound: 'Medium' },
            { driver_number: 16, lap_start: 22, lap_end: null, compound: 'Soft' },
        ];

        //carData
        const carData = [
            { driver_number: 1, drs: 8, speed: 318.0, date: '2025-08-21T12:00:01.000Z' },
            { driver_number: 1, drs: 10, speed: 320.5, date: '2025-08-21T12:00:02.500Z' },
            { driver_number: 16, drs: 8, speed: 312.3, date: '2025-08-21T12:00:02.300Z' }
        ];

        //Start gird
        const startingGrid = [
            { driver_number: 1, position: 2 }, 
            { driver_number: 16, position: 1 }
        ];

        const rows = mergeLive(
            drivers, positions, laps, pits, intervals, stints, carData, startingGrid
        );

        expect(rows).toHaveLength(2);

        //Position order
        expect(rows[0].driverNumber).toBe(1);
        expect(rows[0].position).toBe(1);
        expect(rows[1].driverNumber).toBe(16);
        expect(rows[1].position).toBe(2);

        //DRS
        expect(rows[0].drs).toBe('ON');
        expect(rows[1].drs).toBe('DET');

        //Tyres
        expect(rows[0].tyre).toBe('M'); //Medium
        expect(rows[1].tyre).toBe('S'); //Soft

        //Delta positions
        expect(rows[0].positionsDelta).toBe(1); //P2 to P1
        expect(rows[1].positionsDelta).toBe(-1); //P1 to P2

        //Pits
        expect(rows[0].pits).toBe(0);
        expect(rows[1].pits).toBe(2);

        //Laps ranned
        expect(rows[0].lapsCompleted).toBe(26);
        expect(rows[1].lapsCompleted).toBe(25);

        //Gap to leader
        expect(rows[0].gapToLeaderMs).toBeNull();
        expect(rows[1].gapToLeaderMs).toBe(5432);

        //Best lap
        expect(rows[0].bestLapMs).toBe(80123);
        expect(rows[1].bestLapMs).toBe(80500);

        //Speed
        expect(rows[0].speedKmh).toBeCloseTo(320.5, 1);
        expect(rows[1].speedKmh).toBeCloseTo(312.3, 1);        
    });
});