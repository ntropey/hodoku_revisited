/*
 * Golden-data harness for Hodoku Revisited.
 *
 * Runs the ORIGINAL HoDoKu 2.2.0 solver (compiled from the SourceForge
 * source; see docs/PORT-PLAN.md) and records puzzles and solver results as
 * JSON lines. The TypeScript port is tested against this output.
 *
 * Usage (classpath = compiled HoDoKu 2.2.0 classes):
 *   java Golden gen <count> <seed-ignored>     generate puzzles with HoDoKu's generator
 *   java Golden solve < puzzles.txt            solve every 81-char puzzle on stdin
 *   java Golden all < puzzles.txt              for several states of every puzzle (stuck after singles, then after
 *                                              a few harder steps) print ALL steps of every technique (the
 *                                              "find all steps" functions of SudokuStepFinder)
 *   java Golden solve TYPE,TYPE,... < puzzles  same, but only these techniques are enabled (plus the
 *                                              INCOMPLETE and GIVE_UP defaults); used for rarely needed techniques
 *
 * Copyright (C) 2026 Hodoku Revisited contributors
 * This program is free software under GPLv3-or-later (see LICENSE).
 */
import generator.SudokuGenerator;
import generator.SudokuGeneratorFactory;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.List;
import solver.SudokuSolver;
import solver.SudokuSolverFactory;
import sudoku.Candidate;
import sudoku.ClipboardMode;
import sudoku.SolutionStep;
import sudoku.Sudoku2;

public class Golden {
    public static void main(String[] args) throws Exception {
        System.setProperty("java.awt.headless", "true");
        if (args.length > 0 && args[0].equals("gen")) {
            int n = Integer.parseInt(args[1]);
            SudokuGenerator gen = SudokuGeneratorFactory.getDefaultGeneratorInstance();
            for (int i = 0; i < n; i++) {
                Sudoku2 s = gen.generateSudoku(i % 2 == 0);
                System.out.println(s.getSudoku(ClipboardMode.CLUES_ONLY).replace('\n', ' ').replace("\r", "").trim());
            }
            System.exit(0);
        }
        if (args.length > 0 && args[0].equals("all")) {
            allSteps();
            System.exit(0);
        }
        String only = null;
        if (args.length > 1) {
            only = args[1];
            java.util.Set<String> enabled = new java.util.HashSet<String>(java.util.Arrays.asList(only.split(",")));
            for (sudoku.StepConfig cfg : sudoku.Options.getInstance().solverSteps) {
                String name = cfg.getType().name();
                if (name.equals("INCOMPLETE") || name.equals("GIVE_UP")) continue;
                cfg.setEnabled(enabled.contains(name));
            }
        }
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        SudokuSolver solver = SudokuSolverFactory.getDefaultSolverInstance();
        String line;
        while ((line = in.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) continue;
            Sudoku2 s = new Sudoku2();
            s.setSudoku(line);
            solver.setSudoku(s);
            boolean solved = solver.solve();
            StringBuilder sb = new StringBuilder();
            sb.append("{\"puzzle\":\"").append(line).append("\",");
            if (only != null) sb.append("\"only\":\"").append(only).append("\",");
            sb.append("\"solved\":").append(solved);
            sb.append(",\"score\":").append(solver.getScore());
            sb.append(",\"level\":").append(solver.getLevel().getOrdinal());
            sb.append(",\"steps\":[");
            List<SolutionStep> steps = solver.getSteps();
            for (int i = 0; i < steps.size(); i++) {
                SolutionStep st = steps.get(i);
                if (i > 0) sb.append(",");
                sb.append("{\"type\":\"").append(st.getType().name()).append("\",\"indices\":").append(st.getIndices());
                sb.append(",\"values\":").append(st.getValues()).append(",\"delete\":[");
                List<Candidate> del = st.getCandidatesToDelete();
                for (int j = 0; j < del.size(); j++) {
                    if (j > 0) sb.append(",");
                    sb.append("[").append(del.get(j).getIndex()).append(",").append(del.get(j).getValue()).append("]");
                }
                sb.append("]}");
            }
            sb.append("]}");
            System.out.println(sb);
        }
        System.exit(0);
    }

    // ---------------------------------------------------------------------------------------------
    // "find all steps"

    static String steps(List<SolutionStep> steps) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < steps.size(); i++) {
            SolutionStep st = steps.get(i);
            if (i > 0) sb.append(",");
            sb.append("{\"type\":\"").append(st.getType().name()).append("\",\"indices\":").append(st.getIndices());
            sb.append(",\"values\":").append(st.getValues()).append(",\"delete\":[");
            List<Candidate> del = st.getCandidatesToDelete();
            for (int j = 0; j < del.size(); j++) {
                if (j > 0) sb.append(",");
                sb.append("[").append(del.get(j).getIndex()).append(",").append(del.get(j).getValue()).append("]");
            }
            sb.append("]}");
        }
        return sb.append("]").toString();
    }

    interface Finder {
        List<SolutionStep> find(solver.SudokuStepFinder f, Sudoku2 s);
    }

    static void allSteps() throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        SudokuSolver solver = SudokuSolverFactory.getDefaultSolverInstance();
        final String[] names = {"fullHouses", "nakedSingles", "hiddenSingles", "nakedXle", "hiddenXle", "lockedCandidates",
            "lc1", "lc2", "emptyRectangles", "skyscrapers", "twoStringKites", "uniqueness", "wings", "simpleColors",
            "multiColors", "chains", "alses", "deathBlossoms", "sueDeCoqs", "niceLoops", "groupedNiceLoops",
            "forcingChains", "forcingNets", "templates", "fishBasic", "fishFranken", "fishMutant", "kraken"};
        final Finder[] finders = {
            (f, s) -> f.findAllFullHouses(s), (f, s) -> f.findAllNakedSingles(s), (f, s) -> f.findAllHiddenSingles(s),
            (f, s) -> f.findAllNakedXle(s), (f, s) -> f.findAllHiddenXle(s), (f, s) -> f.findAllLockedCandidates(s),
            (f, s) -> f.findAllLockedCandidates1(s), (f, s) -> f.findAllLockedCandidates2(s),
            (f, s) -> f.findAllEmptyRectangles(s), (f, s) -> f.findAllSkyScrapers(s), (f, s) -> f.findAllTwoStringKites(s),
            (f, s) -> f.getAllUniqueness(s), (f, s) -> f.getAllWings(s), (f, s) -> f.findAllSimpleColors(s),
            (f, s) -> f.findAllMultiColors(s), (f, s) -> f.getAllChains(s), (f, s) -> f.getAllAlses(s, true, true, true),
            (f, s) -> f.getAllDeathBlossoms(s), (f, s) -> f.getAllSueDeCoqs(s), (f, s) -> f.getAllNiceLoops(s),
            (f, s) -> f.getAllGroupedNiceLoops(s), (f, s) -> f.getAllForcingChains(s), (f, s) -> f.getAllForcingNets(s),
            (f, s) -> f.getAllTemplates(s),
            (f, s) -> f.getAllFishes(s, 2, 4, 5, 2, null, -1, 0), (f, s) -> f.getAllFishes(s, 2, 3, 5, 2, null, -1, 1),
            (f, s) -> f.getAllFishes(s, 2, 3, 5, 2, null, -1, 2), (f, s) -> f.getAllKrakenFishes(s, 2, 3, 2, 0, null, -1, 1)};
        String line;
        while ((line = in.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) continue;
            Sudoku2 s = new Sudoku2();
            s.setSudoku(line);
            solver.setSudoku(s);
            // states: stuck after singles; then after k harder steps (and singles again)
            for (int k = 0; k <= 3; k++) {
                SolutionStep st;
                boolean ok = true;
                for (int round = 0; round < 3 && ok; round++) {
                    // singles
                    while ((st = solver.getHint(s, true)) != null) solver.doStep(s, st);
                    if (round < k) {
                        st = solver.getHint(s, false);
                        if (st == null || s.isSolved()) { ok = false; break; }
                        solver.doStep(s, st);
                    }
                }
                if (!ok || s.isSolved()) break;
                if (k > 0 && false) continue;
                Sudoku2 state = new Sudoku2();
                state.set(s);
                StringBuilder sb = new StringBuilder();
                sb.append("{\"puzzle\":\"").append(line).append("\",\"state\":\"").append(s.getSudoku(ClipboardMode.LIBRARY)).append("\",\"all\":{");
                for (int i = 0; i < names.length; i++) {
                    if (i > 0) sb.append(",");
                    sb.append("\"").append(names[i]).append("\":");
                    try {
                        Sudoku2 copy = new Sudoku2();
                        copy.set(state);
                        sb.append(steps(finders[i].find(solver.getStepFinder(), copy)));
                    } catch (Throwable e) {
                        sb.append("\"error: ").append(e.getClass().getSimpleName()).append("\"");
                    }
                }
                sb.append("}}");
                System.out.println(sb);
            }
        }
    }
}
