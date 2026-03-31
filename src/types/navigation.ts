import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { SuitabilityResult, ObstructionAnalysis, SuitabilityVerdict } from './solar';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Assessment: undefined;
  Results: {
    result: SuitabilityResult;
    /** Compass bearing the phone was pointing when the user tapped Assess (degrees from north) */
    bearing: number;
    /** Approximate panel tilt angle in degrees (0° = vertical wall mount, 90° = flat/horizontal) */
    tilt: number;
    latitude: number;
    longitude: number;
    /** Local URI of the sky photo taken at assessment time */
    photoUri?: string;
    /** Sky obstruction analysis from Hugging Face (undefined if analysis failed or was skipped) */
    obstruction?: ObstructionAnalysis;
    /** Score after applying obstruction penalty (undefined if no obstruction data) */
    adjustedScore?: number;
    /** Verdict after applying obstruction penalty */
    adjustedVerdict?: SuitabilityVerdict;
  };
  SetHomeLocation: undefined;
  Account: undefined;
};

// Backward-compat alias used by existing screens
export type RootStackParamList = AppStackParamList;

export type HomeScreenNavProp = NativeStackNavigationProp<AppStackParamList, 'Home'>;
export type AssessmentScreenNavProp = NativeStackNavigationProp<AppStackParamList, 'Assessment'>;
export type ResultsScreenNavProp = NativeStackNavigationProp<AppStackParamList, 'Results'>;
export type ResultsScreenRouteProp = RouteProp<AppStackParamList, 'Results'>;
