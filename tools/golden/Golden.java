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
            sb.append("{\"puzzle\":\"").append(line).append("\",\"solved\":").append(solved);
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
}
