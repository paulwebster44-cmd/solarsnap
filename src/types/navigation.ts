import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { SuitabilityResult } from './solar';

/**
 * Defines every screen in the app and what parameters it receives.
 * Any change to navigation structure should be reflected here first.
 */
export type RootStackParamList = {
  Home: undefined;
  Assessment: undefined;
  Results: {
    result: SuitabilityResult;
    /** Compass bearing the phone was pointing when the user tapped Assess (degrees from north) */
    bearing: number;
    /** Approximate panel tilt angle in degrees (0° = vertical wall mount, 90° = flat/horizontal).
     *  Captured for future use — not yet factored into the suitability calculation. */
    tilt: number;
    latitude: number;
    longitude: number;
    /** Local URI of the sky photo taken at assessment time. Used in Milestone 3 for image analysis. */
    photoUri?: string;
  };
};

export type HomeScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
export type AssessmentScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'Assessment'>;
export type ResultsScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'Results'>;
export type ResultsScreenRouteProp = RouteProp<RootStackParamList, 'Results'>;
